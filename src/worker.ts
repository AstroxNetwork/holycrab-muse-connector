/**
 * Cloudflare Workers entry point.
 *
 * Deploy:
 *   npx wrangler kv namespace create MUSE_KV     # put the id in wrangler.jsonc
 *   npx wrangler secret put CONNECTOR_SECRET
 *   npx wrangler deploy
 *
 * `nodejs_compat` is required: tokens.ts uses node:crypto for HMAC. See
 * wrangler.jsonc.
 */
import { createApp } from "./app.js";
import { createOperations } from "./operations.registry.js";
import { createMemoryConnectionStore } from "./provider.js";
import { createKvConnectionStore, type KvNamespace } from "./store.kv.js";
import { createPlaceholderProvider } from "./providers/placeholder.js";

export interface Env {
  CONNECTOR_SECRET: string;
  PUBLIC_URL?: string;
  DASHBOARD_URL?: string;
  LINK_SECRET?: string;
  /** KV binding declared in wrangler.jsonc. Without it, state is per-isolate. */
  MUSE_KV?: KvNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const publicUrl = (env.PUBLIC_URL ?? "https://muse.holycrab.ai").replace(/\/$/, "");
    const dashboardUrl = (env.DASHBOARD_URL ?? "https://holycrab.ai").replace(/\/$/, "");

    if (!env.CONNECTOR_SECRET || env.CONNECTOR_SECRET.length < 32) {
      // Fail closed and say why: a missing secret would otherwise mint
      // unverifiable tokens, and a short one is not worth HMACing with.
      return new Response(
        JSON.stringify({
          error: "CONNECTOR_SECRET missing or shorter than 32 characters",
        }),
        { status: 500, headers: { "content-type": "application/json" } },
      );
    }

    // ── Swap these two lines when the real service lands ─────────────
    const store = env.MUSE_KV
      ? createKvConnectionStore(env.MUSE_KV)
      : createMemoryConnectionStore();
    const provider = createPlaceholderProvider();
    // ─────────────────────────────────────────────────────────────────

    const app = createApp(
      {
        connectorSecret: env.CONNECTOR_SECRET,
        publicUrl,
        dashboardUrl,
        linkSecret: env.LINK_SECRET || undefined,
        meta: {
          title: "HolyCrab for Muse",
          version: "0.1.0",
          serviceName: "HolyCrab",
          dashboardUrl,
          description:
            "PLACEHOLDER. This connector is a skeleton: the routes below are " +
            "examples, not real capabilities.",
        },
      },
      { registry: createOperations(provider), store, provider },
    );

    return app.fetch(request, env);
  },
};
