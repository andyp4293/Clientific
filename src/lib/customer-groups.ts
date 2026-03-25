import { Prisma } from "@prisma/client";

export const CUSTOMER_GROUP_NAME_MAX_LENGTH = 60;

export function normalizeCustomerGroupName(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export function normalizeCustomerGroupIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    )
  );
}

export function buildPromotionSmsAudienceWhere(
  businessId: string
): Prisma.CustomerWhereInput {
  return {
    businessId,
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
  };
}
