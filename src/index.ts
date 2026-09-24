#!/usr/bin/env node
/**
 * Bootstrap. Reads config from the environment, wires the ports, serves.
 *
 * Required env:
 *   CONNECTOR_SECRET   ≥32 chars, HMAC key for connector tokens.
 *                      Rotating it invalidates every issued token.
 * Optional env:
 *   PORT               default 8787
 *   PUBLIC_URL         default https://muse.holycrab.ai
 *   DASHBOARD_URL      default https://holycrab.ai
 *   LINK_SECRET        shared secret your dashboard backend sends to /v1/link
 */
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createOperations } from "./operations.registry.js";
import { createMemoryConnectionStore } from "./provider.js";
import { createPlaceholderProvider } from "./providers/placeholder.js";

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[muse-connector] ${name} is required`);
    process.exit(2);
  }
  return v;
}

const port = Number(process.env.PORT ?? 8787);
const publicUrl = (process.env.PUBLIC_URL ?? "https://muse.holycrab.ai").replace(/\/$/, "");
const dashboardUrl = (process.env.DASHBOARD_URL ?? "https://holycrab.ai").replace(/\/$/, "");

// ── Swap these two lines when the real service lands ─────────────────
const store = createMemoryConnectionStore();
const provider = createPlaceholderProvider();
// ─────────────────────────────────────────────────────────────────────

const app = createApp(
  {
    connectorSecret: required("CONNECTOR_SECRET"),
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
        "examples, not real capabilities. Replace them once the service " +
        "surface is decided.",
    },
  },
  { registry: createOperations(provider), store, provider },
);

serve({ fetch: app.fetch, port }, () => {
  console.log(`[muse-connector] listening on :${port} (${publicUrl})`);
  console.log(`[muse-connector] openapi: ${publicUrl}/openapi.json`);
  console.log(`[muse-connector] llms:    ${publicUrl}/llms.txt`);
});
