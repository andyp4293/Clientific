import { differenceInDays } from 'date-fns';

export type CustomerSegment = 'NEW' | 'REGULAR' | 'VIP' | 'AT_RISK' | 'CHURNED';

export function calculateCustomerSegment(
  totalVisits: number,
  totalSpent: number,
  lastVisit: Date | null
): CustomerSegment {
  // CHURNED: No visit in 90+ days
  if (lastVisit && differenceInDays(new Date(), lastVisit) > 90) {
    return 'CHURNED';
  }
  
  // AT_RISK: No visit in 60-90 days
  if (lastVisit && differenceInDays(new Date(), lastVisit) >= 60) {
    return 'AT_RISK';
  }
  
  // VIP: 10+ visits OR spent over $500 total
  if (totalVisits >= 10 || totalSpent >= 500) {
    return 'VIP';
  }
  
  // REGULAR: 3-9 visits AND visited within last 90 days
  if (totalVisits >= 3 && totalVisits <= 9) {
    return 'REGULAR';
  }
  
  // NEW: 1-2 visits total
  return 'NEW';
}

export function calculatePointsEarned(
  amountSpent: number | null,
  pointsPerDollar: number,
  pointsPerVisit: number
): number {
  const spendPoints = amountSpent ? Math.floor(amountSpent * pointsPerDollar) : 0;
  return spendPoints + pointsPerVisit;
}
