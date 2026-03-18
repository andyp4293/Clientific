type DealService = {
  id: string;
  name: string;
  price: number | null;
  active?: boolean;
};

type DealPricingInput = {
  deliveryType: string;
  serviceScope: string;
  discountType: string;
  discountValue: number;
};

export type DealPurchaseLineItem = {
  serviceId: string;
  serviceName: string;
  originalUnitAmount: number;
  discountedUnitAmount: number;
  quantity: number;
};

export type DealPurchaseTotals = {
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  items: DealPurchaseLineItem[];
};

export class DealPurchasePricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DealPurchasePricingError';
  }
}

function toCents(value: number | null | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    throw new DealPurchasePricingError('Selected services must have valid prices');
  }

  return Math.round(value * 100);
}

function distributeAmountAcrossItems(amount: number, originalUnitAmounts: number[]): number[] {
  if (amount <= 0) return originalUnitAmounts.map(() => 0);
  const subtotal = originalUnitAmounts.reduce((sum, current) => sum + current, 0);
  if (subtotal <= 0) return originalUnitAmounts.map(() => 0);

  let remainder = amount;
  const discounts = originalUnitAmounts.map((itemAmount, index) => {
    if (index === originalUnitAmounts.length - 1) {
      return remainder;
    }
    const proportional = Math.floor((itemAmount / subtotal) * amount);
    remainder -= proportional;
    return proportional;
  });

  return discounts;
}

export function getSelectableServicesForDeal(
  deal: DealPricingInput,
  selectedServices: DealService[],
  allBusinessServices: DealService[]
): DealService[] {
  if (deal.deliveryType !== 'purchase_link') {
    return [];
  }

  const pool = deal.serviceScope === 'all_services' ? allBusinessServices : selectedServices;
  return pool.filter((service) => service.active !== false);
}

export function resolveSelectedServicesForDeal(
  deal: DealPricingInput,
  selectableServices: DealService[],
  selectedServiceIds: string[]
): DealService[] {
  if (deal.deliveryType !== 'purchase_link') {
    throw new DealPurchasePricingError('This deal must be claimed with a code instead of purchased');
  }

  const normalizedIds = selectedServiceIds
    .map((value) => value.trim())
    .filter(Boolean);

  if (normalizedIds.length === 0) {
    throw new DealPurchasePricingError('Select at least one service to continue');
  }

  const uniqueIds = Array.from(new Set(normalizedIds));
  if (uniqueIds.length !== normalizedIds.length) {
    throw new DealPurchasePricingError('A service can only be selected once');
  }

  const servicesById = new Map(selectableServices.map((service) => [service.id, service]));
  const resolved = uniqueIds.map((id) => servicesById.get(id)).filter(Boolean) as DealService[];

  if (resolved.length !== uniqueIds.length) {
    throw new DealPurchasePricingError('One or more selected services are not eligible for this deal');
  }

  if (deal.discountType === 'free_service' && resolved.length !== 1) {
    throw new DealPurchasePricingError('Free service deals can only include one service');
  }

  return resolved;
}

// Stripe rejects charges below $0.50. If rounding produces a positive total
// below that floor, treat the purchase as free rather than attempting an
// unchargeable amount or rounding up (which would charge more than advertised).
const STRIPE_MINIMUM_CHARGE_CENTS = 50;

function applyStripeMinimum(result: DealPurchaseTotals): DealPurchaseTotals {
  if (result.totalAmount > 0 && result.totalAmount < STRIPE_MINIMUM_CHARGE_CENTS) {
    return {
      subtotalAmount: result.subtotalAmount,
      discountAmount: result.subtotalAmount,
      totalAmount: 0,
      items: result.items.map((item) => ({ ...item, discountedUnitAmount: 0 })),
    };
  }
  return result;
}

export function calculateDealPurchaseTotals(
  deal: DealPricingInput,
  selectedServices: DealService[]
): DealPurchaseTotals {
  if (selectedServices.length === 0) {
    throw new DealPurchasePricingError('Select at least one service to continue');
  }

  const baseItems = selectedServices.map((service) => ({
    serviceId: service.id,
    serviceName: service.name,
    originalUnitAmount: toCents(service.price),
    discountedUnitAmount: 0,
    quantity: 1,
  }));

  const subtotalAmount = baseItems.reduce((sum, item) => sum + item.originalUnitAmount, 0);

  if (deal.discountType === 'free_service') {
    const [item] = baseItems;
    return {
      subtotalAmount,
      discountAmount: item.originalUnitAmount,
      totalAmount: 0,
      items: [{ ...item, discountedUnitAmount: 0 }],
    };
  }

  if (deal.discountType === 'percent_off') {
    if (deal.discountValue <= 0 || deal.discountValue > 100) {
      throw new DealPurchasePricingError('Percent discount must be between 1% and 100%');
    }

    const items = baseItems.map((item) => {
      const discountedUnitAmount = Math.max(
        0,
        Math.round(item.originalUnitAmount * (1 - deal.discountValue / 100))
      );
      return { ...item, discountedUnitAmount };
    });

    const totalAmount = items.reduce((sum, item) => sum + item.discountedUnitAmount, 0);
    const result = { subtotalAmount, discountAmount: subtotalAmount - totalAmount, totalAmount, items };
    return applyStripeMinimum(result);
  }

  if (deal.discountType === 'amount_off') {
    if (deal.discountValue <= 0) {
      throw new DealPurchasePricingError('Dollar discount must be greater than $0');
    }

    const discountAmount = Math.min(subtotalAmount, Math.round(deal.discountValue * 100));
    const distributed = distributeAmountAcrossItems(
      discountAmount,
      baseItems.map((item) => item.originalUnitAmount)
    );
    const items = baseItems.map((item, index) => ({
      ...item,
      discountedUnitAmount: Math.max(0, item.originalUnitAmount - distributed[index]),
    }));
    const result = {
      subtotalAmount,
      discountAmount,
      totalAmount: subtotalAmount - discountAmount,
      items,
    };
    return applyStripeMinimum(result);
  }

  throw new DealPurchasePricingError('Unsupported deal discount type');
}
