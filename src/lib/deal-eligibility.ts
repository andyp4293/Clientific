import { prisma } from '@/lib/prisma';
import { buildCustomerPhoneMatchClauses } from '@/lib/phone';

export class DealEligibilityError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'DealEligibilityError';
    this.status = status;
  }
}

export async function assertDealAudienceEligibility({
  businessId,
  customerPhone,
  newCustomersOnly,
}: {
  businessId: string;
  customerPhone: string | null | undefined;
  newCustomersOnly: boolean;
}) {
  if (!newCustomersOnly || !customerPhone?.trim()) {
    return;
  }

  const existingCustomer = await prisma.customer.findFirst({
    where: {
      businessId,
      OR: buildCustomerPhoneMatchClauses(customerPhone),
    },
    select: { id: true },
  });

  if (existingCustomer) {
    throw new DealEligibilityError(
      'This promotion is only available to new customers. This phone number is already in the business database.',
      409
    );
  }
}
