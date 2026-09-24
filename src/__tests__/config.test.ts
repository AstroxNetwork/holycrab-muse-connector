import { describe, expect, it } from "vitest";
import { ConfigError, buildAppConfig } from "../config.js";

const SECRET = "s".repeat(40);
const base = {
  CONNECTOR_SECRET: SECRET,
  PUBLIC_URL: "https://muse.example.com",
  DASHBOARD_URL: "https://example.com",
};

describe("config is required, not defaulted", () => {
  // The whole point: neither of these may fall back to a literal, because a
  // default would tell Muse to call — and the user to trust — whichever
  // domain the template author happened to ship.
  it("refuses to start without PUBLIC_URL", () => {
    const { PUBLIC_URL, ...rest } = base;
    expect(() => buildAppConfig(rest)).toThrow(/PUBLIC_URL is required/);
  });

  it("refuses to start without DASHBOARD_URL", () => {
    const { DASHBOARD_URL, ...rest } = base;
    expect(() => buildAppConfig(rest)).toThrow(/DASHBOARD_URL is required/);
  });

  it("refuses to start without CONNECTOR_SECRET", () => {
    const { CONNECTOR_SECRET, ...rest } = base;
    expect(() => buildAppConfig(rest)).toThrow(/CONNECTOR_SECRET is required/);
  });

  it("treats blank strings as missing rather than accepting them", () => {
    expect(() => buildAppConfig({ ...base, PUBLIC_URL: "   " })).toThrow(ConfigError);
    expect(() => buildAppConfig({ ...base, DASHBOARD_URL: "" })).toThrow(ConfigError);
  });

  it("rejects a secret short enough to be worth brute-forcing", () => {
    expect(() => buildAppConfig({ ...base, CONNECTOR_SECRET: "too-short" })).toThrow(
      /at least 32 characters/,
    );
  });

  it("suggests how to generate a secret", () => {
    expect(() => buildAppConfig({ ...base, CONNECTOR_SECRET: "nope" })).toThrow(
      /openssl rand/,
    );
  });
});

describe("URL validation", () => {
  it("rejects plain http on a real host, since Muse cannot call it", () => {
    expect(() =>
      buildAppConfig({ ...base, PUBLIC_URL: "http://muse.example.com" }),
    ).toThrow(/must use https/);
  });

  it("allows http on localhost so `npm run dev` works", () => {
    const cfg = buildAppConfig({ ...base, PUBLIC_URL: "http://localhost:8787" });
    expect(cfg.publicUrl).toBe("http://localhost:8787");
  });

  it("strips trailing slashes so concatenated paths stay correct", () => {
    const cfg = buildAppConfig({
      ...base,
      PUBLIC_URL: "https://muse.example.com/",
      DASHBOARD_URL: "https://example.com///",
    });
    expect(cfg.publicUrl).toBe("https://muse.example.com");
    expect(cfg.dashboardUrl).toBe("https://example.com");
  });

  it("rejects a value that is not a URL at all", () => {
    expect(() => buildAppConfig({ ...base, PUBLIC_URL: "muse.example.com" })).toThrow(
      /absolute URL/,
    );
  });
});

describe("service naming", () => {
  it("uses a neutral default rather than any real product name", () => {
    const cfg = buildAppConfig(base);
    expect(cfg.meta.serviceName).toBe("Muse Connector");
    expect(cfg.meta.title).toBe("Muse Connector for Muse".replace(" for Muse", " for Muse"));
  });

  it("accepts a SERVICE_NAME override", () => {
    const cfg = buildAppConfig({ ...base, SERVICE_NAME: "Acme" });
    expect(cfg.meta.serviceName).toBe("Acme");
    expect(cfg.meta.title).toBe("Acme for Muse");
  });
});

describe("optional link secret", () => {
  it("is omitted from the config when unset", () => {
    expect(buildAppConfig(base).linkSecret).toBeUndefined();
  });

  it("is passed through when set", () => {
    expect(buildAppConfig({ ...base, LINK_SECRET: "abc" }).linkSecret).toBe("abc");
  });
});
