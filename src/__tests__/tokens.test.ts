import { describe, expect, it } from "vitest";
import { DEFAULT_TTL_SECS, TOKEN_PREFIX, mintToken, verifyToken } from "../tokens.js";

const SECRET = "x".repeat(40);
const CID = "conn_abc12345";

describe("connector tokens", () => {
  it("round-trips a minted token", () => {
    const token = mintToken(SECRET, CID);
    expect(token.startsWith(TOKEN_PREFIX)).toBe(true);
    const v = verifyToken(SECRET, token);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.payload.cid).toBe(CID);
  });

  it("issues a distinct jti each time, so rate limiting can key on it", () => {
    const a = verifyToken(SECRET, mintToken(SECRET, CID));
    const b = verifyToken(SECRET, mintToken(SECRET, CID));
    expect(a.ok && b.ok && a.payload.jti !== b.payload.jti).toBe(true);
  });

  it("rejects a token signed with another secret", () => {
    const v = verifyToken("y".repeat(40), mintToken(SECRET, CID));
    expect(v).toEqual({ ok: false, reason: "bad signature" });
  });

  it("rejects a tampered payload", () => {
    const token = mintToken(SECRET, CID);
    const [, sig] = token.slice(TOKEN_PREFIX.length).split(".");
    const forged = Buffer.from(
      JSON.stringify({ cid: "conn_evil9999", iat: 0, exp: 9_999_999_999, jti: "z" }),
    ).toString("base64url");
    const v = verifyToken(SECRET, `${TOKEN_PREFIX}${forged}.${sig}`);
    expect(v.ok).toBe(false);
  });

  it("rejects an expired token", () => {
    const token = mintToken(SECRET, CID, 60, Date.now() - 120_000);
    const v = verifyToken(SECRET, token);
    expect(v).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects a foreign token shape", () => {
    expect(verifyToken(SECRET, "Bearer nope").ok).toBe(false);
    expect(verifyToken(SECRET, "mcn_whatever").ok).toBe(false);
  });

  it("refuses a secret that is too short to be worth HMACing with", () => {
    expect(() => mintToken("short", CID)).toThrow(/at least 32/);
  });

  it("defaults to a long TTL because consumer stores are not rotated often", () => {
    const v = verifyToken(SECRET, mintToken(SECRET, CID));
    expect(v.ok && v.payload.exp - v.payload.iat).toBe(DEFAULT_TTL_SECS);
  });
});
