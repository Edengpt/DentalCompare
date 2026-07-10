import { afterEach, describe, expect, it, vi } from "vitest";
import { isPaymentsTestMode } from "./payments-mode";

describe("isPaymentsTestMode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is true only with the flag set AND outside production", () => {
    vi.stubEnv("PAYMENTS_TEST_MODE", "true");
    vi.stubEnv("NODE_ENV", "development");
    expect(isPaymentsTestMode()).toBe(true);
  });

  it("is false in production even with the flag set (never a free path in prod)", () => {
    vi.stubEnv("PAYMENTS_TEST_MODE", "true");
    vi.stubEnv("NODE_ENV", "production");
    expect(isPaymentsTestMode()).toBe(false);
  });

  it("is false when the flag is absent (never a silent default)", () => {
    vi.stubEnv("PAYMENTS_TEST_MODE", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(isPaymentsTestMode()).toBe(false);
  });
});
