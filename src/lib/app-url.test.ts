import { describe, it, expect, afterEach } from "vitest";
import { appUrl } from "./app-url";

const origUrl = process.env.NEXT_PUBLIC_APP_URL;
const origVercelUrl = process.env.VERCEL_URL;
const origNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = origUrl;
  process.env.VERCEL_URL = origVercelUrl;
  // NODE_ENV is read-only in some typings; assign through a cast.
  (process.env as Record<string, string | undefined>).NODE_ENV = origNodeEnv;
});

describe("appUrl", () => {
  it("returns the configured URL without a trailing slash", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://dentalcompare.co.il/";
    expect(appUrl()).toBe("https://dentalcompare.co.il");
  });

  it("falls back to the Vercel deployment URL when NEXT_PUBLIC_APP_URL is unset", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.VERCEL_URL = "dentalcompare-abc123.vercel.app";
    expect(appUrl()).toBe("https://dentalcompare-abc123.vercel.app");
  });

  it("falls back to localhost outside production/Vercel when unset", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_URL;
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    expect(appUrl()).toBe("http://localhost:3000");
  });

  it("throws in production when both app URL and Vercel URL are unset", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_URL;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    expect(() => appUrl()).toThrow(/NEXT_PUBLIC_APP_URL/);
  });
});
