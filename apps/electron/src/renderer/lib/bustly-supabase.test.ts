import { describe, expect, it, vi } from "vitest";

import { resolveWorkspacePlanState } from "./bustly-supabase";

type PlanMapValue = {
  id: string;
  code: string | null;
  name: string | null;
  tier: string | null;
  billing_cycle: string | null;
};

describe("resolveWorkspacePlanState", () => {
  it("treats canceled subscriptions with time remaining as renew state", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-02T12:00:00.000Z"));

    const planState = resolveWorkspacePlanState(
      {
        id: "sub_1",
        plan_id: null,
        status: "canceled",
        current_period_end: "2026-04-10T00:00:00.000Z",
        trial_end_at: null,
        cancel_at_period_end: true,
        benefit_plan: {
          code: "pro",
          name: "Pro",
          tier: "pro",
          billing_cycle: "monthly",
        },
      },
      new Map<string, PlanMapValue>(),
    );

    expect(planState.expired).toBe(false);
    expect(planState.planStatus).toBe("canceled");
    expect(planState.buttonText).toBe("Renew");

    vi.useRealTimers();
  });

  it("treats canceled subscriptions past period end as expired", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-12T12:00:00.000Z"));

    const planState = resolveWorkspacePlanState(
      {
        id: "sub_2",
        plan_id: null,
        status: "canceled",
        current_period_end: "2026-04-10T00:00:00.000Z",
        trial_end_at: null,
        cancel_at_period_end: true,
        benefit_plan: {
          code: "pro",
          name: "Pro",
          tier: "pro",
          billing_cycle: "monthly",
        },
      },
      new Map<string, PlanMapValue>(),
    );

    expect(planState.expired).toBe(true);
    expect(planState.planStatus).toBe("expired");
    expect(planState.buttonText).toBe("Upgrade");

    vi.useRealTimers();
  });
});
