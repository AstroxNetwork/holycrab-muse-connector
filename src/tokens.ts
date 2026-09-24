/**
 * Connector tokens — what a Muse user pastes into Muse's Secure Credentials
 * Store. Stateless: an HMAC-signed statement "this token acts for connection
 * <cid>". No database lookup is needed to *verify* one, which is why the
 * connector can stay a thin front on the provider API.
 *
 * Format: `hcm_<base64url(payload)>.<base64url(hmac-sha256)>`, payload
 * `{ cid, iat, exp, jti }`.
 *
 * Why not just hand Muse the user's raw provider API key?
 *   A raw HolyCrab API key is account-wide: billing, sub-accounts, every
 *   asset. A connector token is scoped to one connection, carries no
 *   provider secret, and can be revoked without rotating the user's key.
 *   The prefix is deliberately distinctive so a leaked token is
 *   identifiable in logs and useless anywhere else.
 *
 * Ported from 1Claw AI's muse-connector (Apache-2.0). See NOTICE.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const TOKEN_PREFIX = "hcm_";
/** A year: a consumer credential store is not somewhere people rotate often. */
export const DEFAULT_TTL_SECS = 365 * 24 * 3600;

export interface TokenPayload {
  /** Connection id this token acts for. */
  cid: string;
  iat: number;
  exp: number;
  jti: string;
}

const b64u = (b: Buffer): string => b.toString("base64url");
const fromB64u = (s: string): Buffer => Buffer.from(s, "base64url");

function sign(secret: string, body: string): Buffer {
  return createHmac("sha256", secret).update(body).digest();
}

export function mintToken(
  secret: string,
  connectionId: string,
  ttlSecs = DEFAULT_TTL_SECS,
  now = Date.now(),
): string {
  if (!secret || secret.length < 32) {
    throw new Error("connector secret must be at least 32 characters");
  }
  const iat = Math.floor(now / 1000);
  const payload: TokenPayload = {
    cid: connectionId,
    iat,
    exp: iat + ttlSecs,
    jti: b64u(randomBytes(12)),
  };
  const body = b64u(Buffer.from(JSON.stringify(payload)));
  return `${TOKEN_PREFIX}${body}.${b64u(sign(secret, body))}`;
}

export type VerifyResult =
  | { ok: true; payload: TokenPayload }
  | { ok: false; reason: string };

export function verifyToken(
  secret: string,
  token: string,
  now = Date.now(),
): VerifyResult {
  if (!token.startsWith(TOKEN_PREFIX)) return { ok: false, reason: "not a connector token" };
  const rest = token.slice(TOKEN_PREFIX.length);
  const dot = rest.indexOf(".");
  if (dot <= 0) return { ok: false, reason: "malformed" };
  const body = rest.slice(0, dot);
  const sig = fromB64u(rest.slice(dot + 1));
  const expected = sign(secret, body);
  // Length check first: timingSafeEqual throws on a length mismatch.
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) {
    return { ok: false, reason: "bad signature" };
  }
  let payload: TokenPayload;
  try {
    payload = JSON.parse(fromB64u(body).toString()) as TokenPayload;
  } catch {
    return { ok: false, reason: "malformed payload" };
  }
  if (typeof payload.cid !== "string" || !/^[0-9a-zA-Z_-]{8,64}$/.test(payload.cid)) {
    return { ok: false, reason: "malformed payload" };
  }
  if (typeof payload.exp !== "number" || payload.exp * 1000 < now) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, payload };
}
