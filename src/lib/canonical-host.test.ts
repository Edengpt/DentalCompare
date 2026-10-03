import { describe, it, expect } from "vitest";
import { legacyRedirect } from "./canonical-host";

describe("legacyRedirect", () => {
  it("moves pages on the old address to the same path on the new one", () => {
    expect(
      legacyRedirect(new URL("https://dentalcompare.co.il/he/clinics/join?x=1"))?.toString(),
    ).toBe("https://dentalcomparing.com/he/clinics/join?x=1");
    expect(legacyRedirect(new URL("https://www.dentalcompare.co.il/"))?.toString()).toBe(
      "https://dentalcomparing.com/",
    );
  });

  it("leaves webhooks and other API calls on the old address alone", () => {
    expect(legacyRedirect(new URL("https://dentalcompare.co.il/api/webhooks/stripe"))).toBeNull();
  });

  it("does nothing on the new address or a preview deployment", () => {
    expect(legacyRedirect(new URL("https://dentalcomparing.com/he"))).toBeNull();
    expect(legacyRedirect(new URL("https://dentalcompare-abc.vercel.app/he"))).toBeNull();
  });
});
