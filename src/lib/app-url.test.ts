import { describe, it, expect, afterEach } from "vitest";
import { appUrl } from "./app-url";

const origUrl = process.env.NEXT_PUBLIC_APP_URL;
const origNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = origUrl;
  // NODE_ENV is read-only in some typings; assign through a cast.
  (process.env as Record<string, string | undefined>).NODE_ENV = origNodeEnv;
});

describe("appUrl", () => {
  it("returns the configured URL without a trailing slash", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://dentalcompare.co.il/";
    expect(appUrl()).toBe("https://dentalcompare.co.il");
  });

  it("falls back to localhost outside production when unset", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    expect(appUrl()).toBe("http://localhost:3000");
  });

  it("throws in production when unset — never ships localhost links", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    expect(() => appUrl()).toThrow(/NEXT_PUBLIC_APP_URL/);
  });
});
