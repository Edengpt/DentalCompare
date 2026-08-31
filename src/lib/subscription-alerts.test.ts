import { describe, it, expect } from "vitest";
import { needsOperatorAttentionWhere } from "./subscription-alerts";

describe("needsOperatorAttentionWhere", () => {
  // The badge and the screen must ask one question, not two that drifted.
  it("selects exactly the trials that ended with no way to charge them", () => {
    expect(needsOperatorAttentionWhere()).toEqual({ trialEndedUnbilledAt: { not: null } });
  });

  // PAST_DUE is retried daily inside the grace window; it needs the cron, not a
  // person. Putting it here would make the badge permanently non-zero and so
  // permanently ignored.
  it("does not flag a subscription the cron is still retrying", () => {
    expect(needsOperatorAttentionWhere()).not.toHaveProperty("status");
  });
});
