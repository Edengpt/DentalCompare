import { describe, it, expect, vi, beforeEach } from "vitest";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { auditLog: { create } } }));

import { audit } from "./audit";

describe("audit()", () => {
  beforeEach(() => create.mockReset());

  it("writes the entry to the audit log", async () => {
    create.mockResolvedValue({});
    await audit({
      actor: "admin@example.com",
      action: "clinic.approve",
      entity: "Dentist",
      entityId: "d_1",
      metadata: { clinicName: "X" },
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        actor: "admin@example.com",
        action: "clinic.approve",
        entity: "Dentist",
        entityId: "d_1",
        metadata: { clinicName: "X" },
      },
    });
  });

  it("is fire-and-forget: it returns void and doesn't surface the create result", async () => {
    create.mockResolvedValue({ id: "audit_1" });
    const result = await audit({ actor: "system", action: "x", entity: "Y", entityId: "z" });
    expect(result).toBeUndefined();
    expect(create).toHaveBeenCalledTimes(1);
  });
});
