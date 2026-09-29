import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { DESTINATION_PHOTOS } from "./destination-photos";

describe("DESTINATION_PHOTOS", () => {
  it("points every entry at a file that ships in public/", () => {
    const missing = Object.values(DESTINATION_PHOTOS)
      .map((p) => p.src)
      .filter((src) => !existsSync(path.join(process.cwd(), "public", src)));
    expect(missing).toEqual([]);
  });

  it("credits every photo with an author, a licence and a source", () => {
    for (const p of Object.values(DESTINATION_PHOTOS)) {
      expect(p.author).not.toBe("");
      expect(p.license).toMatch(/^(CC0|CC BY(-SA)? \d\.\d)$/);
      expect(p.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    }
  });
});
