import { Prisma } from "@prisma/client";
import type {
  CustomerContactFilter,
  CustomerSegmentFilter,
  CustomerSmsFilter,
  CustomerVisitFilter,
} from "@/lib/customer-filter-options";

type CustomerFilterParams = {
  businessId: string;
  search?: string;
  segment?: CustomerSegmentFilter | string;
  sms?: CustomerSmsFilter | string;
  contact?: CustomerContactFilter | string;
  visit?: CustomerVisitFilter | string;
};

export function buildCustomerWhereClause({
  businessId,
  search,
  segment,
  sms,
  contact,
  visit,
}: CustomerFilterParams): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = { businessId };
  const andClauses: Prisma.CustomerWhereInput[] = [];

  if (search?.trim()) {
    andClauses.push({
      OR: [
        { name: { contains: search.trim(), mode: "insensitive" } },
        { email: { contains: search.trim(), mode: "insensitive" } },
        { phone: { contains: search.trim(), mode: "insensitive" } },
      ],
    });
  }

  if (segment) {
    andClauses.push({ segment });
  }

  switch (sms) {
    case "enabled":
      andClauses.push({
        phone: { not: null },
        smsConsent: true,
        smsOptedOut: false,
      });
      break;
    case "opted_out":
      andClauses.push({ smsOptedOut: true });
      break;
    case "denied":
      andClauses.push({
        phone: { not: null },
        smsConsent: false,
        smsOptedOut: false,
      });
      break;
    case "no_phone":
      andClauses.push({ phone: null });
      break;
  }

  switch (contact) {
    case "email":
      andClauses.push({ email: { not: null } });
      break;
    case "phone":
      andClauses.push({ phone: { not: null } });
      break;
    case "both":
      andClauses.push({
        email: { not: null },
        phone: { not: null },
      });
      break;
  }

  switch (visit) {
    case "visited":
      andClauses.push({ lastVisit: { not: null } });
      break;
    case "never":
      andClauses.push({ lastVisit: null });
      break;
  }

  if (andClauses.length > 0) {
    where.AND = andClauses;
  }

  return where;
}
