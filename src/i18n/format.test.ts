import { describe, it, expect } from "vitest";
import { format, plural } from "./format";

describe("format", () => {
  it("substitutes named placeholders", () => {
    expect(format("{shown} of {total} clinics", { shown: 2, total: 9 })).toBe("2 of 9 clinics");
  });

  it("substitutes the same placeholder more than once", () => {
    expect(format("{a} and {a}", { a: "x" })).toBe("x and x");
  });

  it("leaves an unknown placeholder visible instead of printing undefined", () => {
    // A stray {name} in the output is an obvious bug; "undefined" mid-sentence
    // reads like real copy and survives review.
    expect(format("hello {name}", {})).toBe("hello {name}");
  });

  it("handles a template with no placeholders", () => {
    expect(format("nothing here", { a: 1 })).toBe("nothing here");
  });
});

describe("plural", () => {
  const forms = { one: "1 clinic", other: "{count} clinics" };

  it("uses the singular for exactly one", () => {
    expect(plural(forms, 1)).toBe("1 clinic");
  });

  it("uses the plural for zero and for many", () => {
    expect(plural(forms, 0)).toBe("0 clinics");
    expect(plural(forms, 5)).toBe("5 clinics");
  });

  it("passes extra values through to the template", () => {
    expect(plural({ one: "{city}: 1", other: "{city}: {count}" }, 3, { city: "Tel Aviv" })).toBe(
      "Tel Aviv: 3",
    );
  });
});
