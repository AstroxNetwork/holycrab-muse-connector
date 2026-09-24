/**
 * ┌──────────────────────────────────────────────────────────────────┐
 * │  THIS IS THE FILE YOU EDIT WHEN THE BUSINESS IS DECIDED.         │
 * │                                                                  │
 * │  1. Delete the three `demo*` operations below.                   │
 * │  2. Add one Operation per capability.                            │
 * │  3. Implement the matching method on your provider.              │
 * │                                                                  │
 * │  Routes, /openapi.json and /llms.txt all regenerate themselves.  │
 * └──────────────────────────────────────────────────────────────────┘
 */
import { z } from "zod";
import { createRegistry, type Operation, type Registry } from "./operations.js";
import type { ProviderPort } from "./provider.js";

export function createOperations(provider: ProviderPort): Registry {
  const operations: Operation[] = [
    // ── Always present ───────────────────────────────────────────────
    // Muse calls this first to learn who it is acting for and what has
    // been granted. Keep it: it is the cheapest way for the model to
    // recover when it is unsure, and the natural place to surface a
    // revoked connection.
    {
      id: "whoAmI",
      method: "get",
      path: "/v1/me",
      summary: "Which account this token acts for, and what has been granted",
      description:
        "Use this when the person asks what you can do, which account you are connected to, or before starting work to confirm the connection is still live.",
      outputSchema: {
        type: "object",
        properties: {
          connection_id: { type: "string" },
          status: { type: "string" },
          subject: { type: "string", nullable: true },
          granted: { type: "array", items: { type: "string" } },
        },
        required: ["connection_id", "status"],
      },
      handler: ({ provider: p, connection }) => p.whoami(connection),
    },

    // ── DEMO 1: a plain read ─────────────────────────────────────────
    {
      id: "demoListThings",
      method: "get",
      path: "/v1/things",
      summary: "List the person's items (PLACEHOLDER)",
      description:
        "Placeholder read operation. Replace with the first real listing your service offers.",
      queryParams: [
        {
          name: "limit",
          description: "Maximum number of items to return (1–100).",
          schema: { type: "integer", minimum: 1, maximum: 100, default: 25 },
        },
      ],
      outputSchema: {
        type: "object",
        properties: {
          things: { type: "array", items: { type: "object", additionalProperties: true } },
          count: { type: "integer" },
        },
      },
      handler: async ({ provider: p, connection, query }) => {
        if (!p.demoListThings) throw new Error("provider does not implement demoListThings");
        const raw = Number(query.get("limit") ?? 25);
        const limit = Number.isFinite(raw) ? Math.min(Math.max(raw, 1), 100) : 25;
        return p.demoListThings(connection, { limit });
      },
    },

    // ── DEMO 2: metered + async — the pattern that matters ───────────
    // This is the shape almost every real capability in a generation
    // service will take: it costs the person something and it finishes
    // later. Note how the cost is stated in prose the model reads, and
    // how the async hint wires the model to the poll operation.
    {
      id: "demoCreateJob",
      method: "post",
      path: "/v1/jobs",
      summary: "Start a metered job (PLACEHOLDER)",
      description:
        "Placeholder for a paid, long-running action. Replace with the real one.",
      input: {
        schema: z.object({
          prompt: z.string().min(1).max(4_000),
        }),
      },
      spends: {
        kind: "credits",
        note: "Placeholder: each call would consume credits.",
      },
      async: { pollWith: "demoGetJob", typicalSeconds: 5 },
      outputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          status: { type: "string" },
        },
        required: ["id", "status"],
      },
      handler: async ({ provider: p, connection, body, idempotencyKey }) => {
        if (!p.demoCreateJob) throw new Error("provider does not implement demoCreateJob");
        return p.demoCreateJob(
          connection,
          body as Record<string, unknown>,
          idempotencyKey,
        );
      },
    },

    // ── DEMO 3: the poll target ──────────────────────────────────────
    {
      id: "demoGetJob",
      method: "get",
      path: "/v1/jobs/{id}",
      summary: "Check one job's progress (PLACEHOLDER)",
      description:
        "Placeholder status read. Polling this is free and safe; it never starts new work.",
      queryParams: [],
      outputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          status: { type: "string", enum: ["pending", "succeeded", "failed", "cancelled"] },
          result: { type: "object", additionalProperties: true, nullable: true },
        },
        required: ["id", "status"],
      },
      handler: async ({ provider: p, connection, params }) => {
        if (!p.demoGetJob) throw new Error("provider does not implement demoGetJob");
        const id = params.id;
        if (!id) throw new Error("missing job id in path");
        return p.demoGetJob(connection, id);
      },
    },
  ];

  return createRegistry(operations);
}
