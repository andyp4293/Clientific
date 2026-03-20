import { describe, expect, it } from "vitest";
import { buildCustomerWhereClause } from "./customer-filters";

describe("buildCustomerWhereClause", () => {
  it("combines search, customer type, sms, contact, and visit filters into one where clause", () => {
    expect(
      buildCustomerWhereClause({
        businessId: "biz-1",
        search: "alice",
        segment: "VIP",
        sms: "enabled",
        contact: "both",
        visit: "visited",
      }),
    ).toEqual({
      businessId: "biz-1",
      AND: [
        {
          OR: [
            { name: { contains: "alice", mode: "insensitive" } },
            { email: { contains: "alice", mode: "insensitive" } },
            { phone: { contains: "alice", mode: "insensitive" } },
          ],
        },
        { segment: "VIP" },
        {
          phone: { not: null },
          smsConsent: true,
          smsOptedOut: false,
        },
        {
          email: { not: null },
          phone: { not: null },
        },
        {
          lastVisit: { not: null },
        },
      ],
    });
  });

  it("supports no-phone and never-visited filters", () => {
    expect(
      buildCustomerWhereClause({
        businessId: "biz-1",
        sms: "no_phone",
        visit: "never",
      }),
    ).toEqual({
      businessId: "biz-1",
      AND: [{ phone: null }, { lastVisit: null }],
    });
  });
});
