/**
 * Config resolution, shared by all three entry points (Node, Workers, Vercel).
 *
 * Why this is strict: `PUBLIC_URL` and `DASHBOARD_URL` do not just sit in a
 * log line. `PUBLIC_URL` becomes the OpenAPI `servers` entry — the address
 * Muse is told to call — and `DASHBOARD_URL` is printed to users as the place
 * to review or revoke access.
 *
 * Defaulting either one to a domain would mean a developer who forgets to set
 * it ships a connector that sends Muse, and their users, to somebody else's
 * website. So there are no defaults: missing config is a startup failure with
 * an actionable message.
 */
import type { AppConfig } from "./app.js";

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export interface EnvLike {
  CONNECTOR_SECRET?: string;
  PUBLIC_URL?: string;
  DASHBOARD_URL?: string;
  LINK_SECRET?: string;
  /** Shown in the OpenAPI title, /health and llms.txt. */
  SERVICE_NAME?: string;
  [key: string]: unknown;
}

function str(env: EnvLike, name: string): string | undefined {
  const v = env[name];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function requireStr(env: EnvLike, name: string, why: string): string {
  const v = str(env, name);
  if (!v) throw new ConfigError(`${name} is required — ${why}`);
  return v;
}

/**
 * Absolute http(s) URL with no trailing slash. Localhost is allowed over
 * plain http so `npm run dev` works without TLS.
 */
function requireUrl(env: EnvLike, name: string, why: string): string {
  const raw = requireStr(env, name, why);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ConfigError(`${name} must be an absolute URL, got "${raw}"`);
  }
  const localhost = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && localhost)) {
    throw new ConfigError(
      `${name} must use https (Muse runs in a remote VM and will not call plain http), got "${raw}"`,
    );
  }
  return raw.replace(/\/+$/, "");
}

export function buildAppConfig(env: EnvLike): AppConfig {
  const connectorSecret = requireStr(
    env,
    "CONNECTOR_SECRET",
    "it signs the connector tokens users paste into Muse",
  );
  if (connectorSecret.length < 32) {
    throw new ConfigError(
      `CONNECTOR_SECRET must be at least 32 characters (got ${connectorSecret.length}). ` +
        `Generate one with: openssl rand -base64 48`,
    );
  }

  const publicUrl = requireUrl(
    env,
    "PUBLIC_URL",
    "it is the address Muse is told to call, and goes in the OpenAPI servers entry",
  );
  const dashboardUrl = requireUrl(
    env,
    "DASHBOARD_URL",
    "it is where users are sent to review or revoke access",
  );

  const serviceName = str(env, "SERVICE_NAME") ?? "Muse Connector";

  return {
    connectorSecret,
    publicUrl,
    dashboardUrl,
    ...(str(env, "LINK_SECRET") ? { linkSecret: str(env, "LINK_SECRET")! } : {}),
    meta: {
      title: `${serviceName} for Muse`,
      version: "0.1.0",
      serviceName,
      dashboardUrl,
      description:
        "PLACEHOLDER. This connector is a skeleton: the operations below are " +
        "examples, not real capabilities. Replace them in " +
        "src/operations.registry.ts.",
    },
  };
}
