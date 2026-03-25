import { describe, expect, it } from "vitest";
import {
  buildPromotionSmsAudienceWhere,
  CUSTOMER_GROUP_NAME_MAX_LENGTH,
  normalizeCustomerGroupIds,
  normalizeCustomerGroupName,
} from "./customer-groups";

describe("customer-groups helpers", () => {
  it("normalizes group names without stripping meaningful text", () => {
    expect(normalizeCustomerGroupName("  VIP    regulars   ")).toBe("VIP regulars");
    expect(normalizeCustomerGroupName(null)).toBe("");
  });

  it("normalizes group ids by trimming, deduplicating, and dropping blanks", () => {
    expect(
      normalizeCustomerGroupIds([" group-1 ", "group-2", "", "group-1", "   ", 42, null])
    ).toEqual(["group-1", "group-2"]);
  });

  it("builds the promotion SMS audience guardrail query", () => {
    expect(buildPromotionSmsAudienceWhere("biz-1")).toEqual({
      businessId: "biz-1",
      smsMarketingConsent: true,
      smsOptedOut: false,
      dealSmsBlocked: false,
      phone: { not: null },
      OR: [
        {
          groupMemberships: {
            none: {},
          },
        },
        {
          groupMemberships: {
            some: {
              group: {
                promotionSmsEnabled: true,
              },
            },
          },
        },
      ],
    });
  });

  it("keeps the server-side group name limit aligned with the UI", () => {
    expect(CUSTOMER_GROUP_NAME_MAX_LENGTH).toBe(60);
  });
});
