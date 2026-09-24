/**
 * Vercel entry point (Node.js serverless function).
 *
 * `vercel.json` rewrites every path to this function so the connector's
 * public URLs stay at the root — Muse must see
 * https://muse.holycrab.ai/openapi.json, not /api/openapi.json.
 *
 * Deploy:
 *   vercel env add CONNECTOR_SECRET        # ≥32 chars
 *   vercel env add KV_REST_API_URL         # Vercel KV / Upstash
 *   vercel env add KV_REST_API_TOKEN
 *   vercel deploy --prod
 */
import { handle } from "hono/vercel";
import { createApp } from "../src/app.js";
import { createOperations } from "../src/operations.registry.js";
import { createMemoryConnectionStore } from "../src/provider.js";
import { createKvConnectionStore } from "../src/store.kv.js";
import { kvFromEnv } from "../src/store.upstash.js";
import { createPlaceholderProvider } from "../src/providers/placeholder.js";

export const config = { runtime: "nodejs" };

const publicUrl = (process.env.PUBLIC_URL ?? "https://muse.holycrab.ai").replace(/\/$/, "");
const dashboardUrl = (process.env.DASHBOARD_URL ?? "https://holycrab.ai").replace(/\/$/, "");

function build() {
  const secret = process.env.CONNECTOR_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("CONNECTOR_SECRET missing or shorter than 32 characters");
  }

  // ── Swap these two lines when the real service lands ───────────────
  const kv = kvFromEnv();
  const store = kv ? createKvConnectionStore(kv) : createMemoryConnectionStore();
  const provider = createPlaceholderProvider();
  // ───────────────────────────────────────────────────────────────────

  return createApp(
    {
      connectorSecret: secret,
      publicUrl,
      dashboardUrl,
      linkSecret: process.env.LINK_SECRET || undefined,
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
}

// Built once per instance; without KV this also serves as the dev fallback.
const app = build();

export default handle(app);
