/**
 * Cloudflare Workers entry point.
 *
 * Deploy:
 *   npx wrangler secret put CONNECTOR_SECRET
 *   # set PUBLIC_URL and DASHBOARD_URL in wrangler.jsonc (or as secrets)
 *   npx wrangler deploy
 *
 * `nodejs_compat` is required: tokens.ts uses node:crypto for HMAC. See
 * wrangler.jsonc.
 *
 * There are no fallbacks for PUBLIC_URL or DASHBOARD_URL: they decide where
 * Muse is told to call and where users are sent to revoke access, so a wrong
 * default is worse than a startup error.
 */
import { createApp } from "./app.js";
import { ConfigError, buildAppConfig, type EnvLike } from "./config.js";
import { createOperations } from "./operations.registry.js";
import { createMemoryConnectionStore } from "./provider.js";
import { createKvConnectionStore, type KvNamespace } from "./store.kv.js";
import { createPlaceholderProvider } from "./providers/placeholder.js";

export interface Env extends EnvLike {
  /** KV binding declared in wrangler.jsonc. Without it, state is per-isolate. */
  MUSE_KV?: KvNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    let config;
    try {
      config = buildAppConfig(env);
    } catch (e) {
      // Fail closed and say why. A misconfigured connector that still served
      // traffic would advertise the wrong URL to Muse.
      const message = e instanceof ConfigError ? e.message : "invalid configuration";
      console.error(`[muse-connector] ${message}`);
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    // ── Swap these two lines when the real service lands ─────────────
    const store = env.MUSE_KV
      ? createKvConnectionStore(env.MUSE_KV)
      : createMemoryConnectionStore();
    const provider = createPlaceholderProvider();
    // ─────────────────────────────────────────────────────────────────

    if (!env.MUSE_KV) {
      // Loud on purpose. The failure mode is silent and confusing: people
      // get logged out at random as requests land on fresh isolates, and a
      // "disconnect" that only reaches one isolate stops meaning anything.
      console.warn(
        "[muse-connector] MUSE_KV is not bound — connections are per-isolate " +
          "and revocation is not durable. Bind a KV namespace before real use.",
      );
    }

    const app = createApp(config, {
      registry: createOperations(provider),
      store,
      provider,
    });

    return app.fetch(request, env);
  },
};
