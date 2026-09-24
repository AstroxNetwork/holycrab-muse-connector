#!/usr/bin/env node
/**
 * Node entry point (local dev, Docker, any long-running host).
 *
 * Required env:
 *   CONNECTOR_SECRET   ≥32 chars. Signs the tokens users paste into Muse.
 *                      Rotating it invalidates every issued token.
 *   PUBLIC_URL         the address Muse will call, e.g. https://muse.example.com
 *   DASHBOARD_URL      where users review/revoke access, e.g. https://example.com
 * Optional env:
 *   LINK_SECRET        shared secret your dashboard sends to POST /v1/link
 *   SERVICE_NAME       shown in OpenAPI/llms.txt; default "Muse Connector"
 *   PORT               default 8787
 *
 * There are no defaults for PUBLIC_URL or DASHBOARD_URL on purpose: they end
 * up in the OpenAPI `servers` entry and in text shown to users, so guessing
 * them would point Muse — and the user — at the wrong site.
 */
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { ConfigError, buildAppConfig } from "./config.js";
import { createOperations } from "./operations.registry.js";
import { createMemoryConnectionStore } from "./provider.js";
import { createKvConnectionStore } from "./store.kv.js";
import { kvFromEnv } from "./store.upstash.js";
import { createPlaceholderProvider } from "./providers/placeholder.js";

const port = Number(process.env.PORT ?? 8787);

let config;
try {
  config = buildAppConfig(process.env);
} catch (e) {
  if (e instanceof ConfigError) {
    console.error(`[muse-connector] ${e.message}`);
    process.exit(2);
  }
  throw e;
}

// ── Swap these two lines when the real service lands ─────────────────
const kv = kvFromEnv();
const store = kv ? createKvConnectionStore(kv) : createMemoryConnectionStore();
const provider = createPlaceholderProvider();
// ─────────────────────────────────────────────────────────────────────

if (!kv) {
  console.warn(
    "[muse-connector] no KV configured — connections are held in memory and " +
      "revocation is not durable. Fine for local dev; set KV_REST_API_URL and " +
      "KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_*) before real use.",
  );
}

const app = createApp(config, {
  registry: createOperations(provider),
  store,
  provider,
});

serve({ fetch: app.fetch, port }, () => {
  console.log(`[muse-connector] listening on :${port} (${config.publicUrl})`);
  console.log(`[muse-connector] openapi: ${config.publicUrl}/openapi.json`);
  console.log(`[muse-connector] llms:    ${config.publicUrl}/llms.txt`);
});
