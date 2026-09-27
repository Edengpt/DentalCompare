import { describe, expect, it } from "vitest";
import {
  clinicDetailsSchema,
  clinicPlanSchema,
  fieldErrors,
  readRegistrationFields,
} from "./clinic-registration-schema";

function details(overrides: Record<string, string> = {}) {
  return {
    contactName: "Dana",
    dentistName: "Dr. Levi",
    clinicName: "Smile",
    email: "Clinic@Example.com ",
    phone: "050-1234567",
    city: "Haifa",
    address: "Herzl 1",
    experienceYears: "12",
    countryCode: "IL",
    ...overrides,
  };
}

describe("clinicDetailsSchema", () => {
  it("accepts a complete step and normalises the email", () => {
    const r = clinicDetailsSchema.safeParse(details());
    expect(r.success).toBe(true);
    expect(r.data?.email).toBe("clinic@example.com");
    expect(r.data?.experienceYears).toBe(12);
  });

  it("flags every empty required field by name", () => {
    const r = clinicDetailsSchema.safeParse(details({ clinicName: "  ", city: "" }));
    expect(fieldErrors(r)).toMatchObject({ clinicName: "fieldRequired", city: "fieldRequired" });
  });

  it("rejects an email without a domain", () => {
    const r = clinicDetailsSchema.safeParse(details({ email: "clinic@" }));
    expect(fieldErrors(r)).toEqual({ email: "invalidEmail" });
  });

  it("rejects negative or non-numeric experience, but not a missing one as invalid", () => {
    expect(fieldErrors(clinicDetailsSchema.safeParse(details({ experienceYears: "-1" })))).toEqual({
      experienceYears: "invalidExperience",
    });
    expect(fieldErrors(clinicDetailsSchema.safeParse(details({ experienceYears: "abc" })))).toEqual(
      {
        experienceYears: "invalidExperience",
      },
    );
    expect(fieldErrors(clinicDetailsSchema.safeParse(details({ experienceYears: "" })))).toEqual({
      experienceYears: "fieldRequired",
    });
  });

  it("asks for a country when none is chosen", () => {
    const r = clinicDetailsSchema.safeParse(details({ countryCode: "" }));
    expect(fieldErrors(r)).toEqual({ countryCode: "mustPickCountry" });
  });
});

describe("clinicPlanSchema", () => {
  it("accepts a plan with the terms ticked", () => {
    expect(clinicPlanSchema.safeParse({ plan: "YEARLY", agreeToTerms: "on" }).success).toBe(true);
  });

  it("refuses an unknown plan", () => {
    const r = clinicPlanSchema.safeParse({ plan: "FOREVER", agreeToTerms: "on" });
    expect(fieldErrors(r)).toEqual({ plan: "mustPickPlan" });
  });

  it("refuses when the terms were not accepted", () => {
    const r = clinicPlanSchema.safeParse({ plan: "MONTHLY", agreeToTerms: "" });
    expect(fieldErrors(r)).toEqual({ agreeToTerms: "mustAcceptTerms" });
  });
});

describe("readRegistrationFields", () => {
  it("reads every field as a string, missing ones as empty", () => {
    const fd = new FormData();
    fd.set("clinicName", "Smile");
    fd.set("agreeToTerms", "on");
    const fields = readRegistrationFields(fd);
    expect(fields.clinicName).toBe("Smile");
    expect(fields.agreeToTerms).toBe("on");
    expect(fields.email).toBe("");
    expect(fields.plan).toBe("");
  });
});
