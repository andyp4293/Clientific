import { prisma } from '@/lib/prisma';

export async function updateCustomerSegment(customerId: string): Promise<void> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { totalSpent: true, lastVisit: true },
  });
  if (!customer) return;

  const totalVisits = await prisma.checkIn.count({ where: { customerId } });
  const daysSinceVisit = customer.lastVisit
    ? (Date.now() - customer.lastVisit.getTime()) / 86400000
    : Infinity;

  let segment = 'NEW';
  if (totalVisits > 0) {
    if (daysSinceVisit > 120) segment = 'CHURNED';
    else if (daysSinceVisit > 60) segment = 'AT_RISK';
    else if (totalVisits >= 6 || customer.totalSpent >= 500) segment = 'VIP';
    else if (totalVisits >= 2) segment = 'REGULAR';
  }

  await prisma.customer.update({ where: { id: customerId }, data: { segment } });
}
