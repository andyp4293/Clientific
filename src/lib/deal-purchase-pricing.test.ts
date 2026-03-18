import { describe, it, expect } from 'vitest';
import {
  calculateDealPurchaseTotals,
  DealPurchasePricingError,
  resolveSelectedServicesForDeal,
} from './deal-purchase-pricing';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeDeal(overrides: Partial<{
  discountType: string;
  discountValue: number;
  deliveryType: string;
  serviceScope: string;
}> = {}) {
  return {
    deliveryType: 'purchase_link',
    serviceScope: 'all_services',
    discountType: 'percent_off',
    discountValue: 20,
    ...overrides,
  };
}

function makeServices(...prices: number[]) {
  return prices.map((price, i) => ({
    id: `svc-${i + 1}`,
    name: `Service ${i + 1}`,
    price,
  }));
}

// ── percent_off ────────────────────────────────────────────────────────────────

describe('calculateDealPurchaseTotals — percent_off', () => {
  it('applies correct percentage discount', () => {
    const result = calculateDealPurchaseTotals(makeDeal({ discountValue: 20 }), makeServices(50));
    expect(result.subtotalAmount).toBe(5000);
    expect(result.totalAmount).toBe(4000);
    expect(result.discountAmount).toBe(1000);
    expect(result.items[0].discountedUnitAmount).toBe(4000);
  });

  it('100% off results in free purchase ($0 total)', () => {
    const result = calculateDealPurchaseTotals(makeDeal({ discountValue: 100 }), makeServices(30));
    expect(result.totalAmount).toBe(0);
    expect(result.discountAmount).toBe(3000);
  });

  it('throws for percent > 100', () => {
    expect(() =>
      calculateDealPurchaseTotals(makeDeal({ discountValue: 150 }), makeServices(30))
    ).toThrow(DealPurchasePricingError);
    expect(() =>
      calculateDealPurchaseTotals(makeDeal({ discountValue: 150 }), makeServices(30))
    ).toThrow('between 1% and 100%');
  });

  it('throws for percent = 0', () => {
    expect(() =>
      calculateDealPurchaseTotals(makeDeal({ discountValue: 0 }), makeServices(30))
    ).toThrow(DealPurchasePricingError);
  });

  it('throws for negative percent', () => {
    expect(() =>
      calculateDealPurchaseTotals(makeDeal({ discountValue: -10 }), makeServices(30))
    ).toThrow(DealPurchasePricingError);
  });

  it('distributes discount across multiple services', () => {
    const result = calculateDealPurchaseTotals(
      makeDeal({ discountValue: 50 }),
      makeServices(40, 60)
    );
    expect(result.subtotalAmount).toBe(10000);
    expect(result.totalAmount).toBe(5000);
    expect(result.items.every((item) => item.discountedUnitAmount > 0)).toBe(true);
  });

  // Stripe minimum: $1 service at 99% off = $0.01 → below $0.50 threshold
  it('treats result below Stripe minimum ($0.50) as free', () => {
    const result = calculateDealPurchaseTotals(
      makeDeal({ discountValue: 99 }),
      makeServices(1) // $1 service → 99% off = $0.01
    );
    expect(result.totalAmount).toBe(0);
    expect(result.discountAmount).toBe(result.subtotalAmount);
    expect(result.items[0].discountedUnitAmount).toBe(0);
  });

  it('keeps result exactly at $0.50 as chargeable (not free)', () => {
    // $50 service at 99% off = $0.50 — exactly at minimum, should be charged
    const result = calculateDealPurchaseTotals(
      makeDeal({ discountValue: 99 }),
      makeServices(50) // $50 × 0.01 = $0.50
    );
    expect(result.totalAmount).toBe(50); // 50 cents
  });
});

// ── amount_off ─────────────────────────────────────────────────────────────────

describe('calculateDealPurchaseTotals — amount_off', () => {
  it('applies correct dollar discount', () => {
    const result = calculateDealPurchaseTotals(
      makeDeal({ discountType: 'amount_off', discountValue: 10 }),
      makeServices(30)
    );
    expect(result.subtotalAmount).toBe(3000);
    expect(result.totalAmount).toBe(2000);
    expect(result.discountAmount).toBe(1000);
  });

  it('caps discount at subtotal when discount > service price (e.g. $50 off on $30 service)', () => {
    const result = calculateDealPurchaseTotals(
      makeDeal({ discountType: 'amount_off', discountValue: 50 }),
      makeServices(30)
    );
    expect(result.subtotalAmount).toBe(3000);
    expect(result.totalAmount).toBe(0); // capped — cannot go negative
    expect(result.discountAmount).toBe(3000);
    expect(result.items[0].discountedUnitAmount).toBe(0);
  });

  it('caps discount at subtotal when discount > combined service prices', () => {
    const result = calculateDealPurchaseTotals(
      makeDeal({ discountType: 'amount_off', discountValue: 100 }),
      makeServices(30, 40) // $70 total
    );
    expect(result.totalAmount).toBe(0);
    expect(result.discountAmount).toBe(7000);
  });

  it('throws for $0 discount', () => {
    expect(() =>
      calculateDealPurchaseTotals(
        makeDeal({ discountType: 'amount_off', discountValue: 0 }),
        makeServices(30)
      )
    ).toThrow(DealPurchasePricingError);
    expect(() =>
      calculateDealPurchaseTotals(
        makeDeal({ discountType: 'amount_off', discountValue: 0 }),
        makeServices(30)
      )
    ).toThrow('greater than $0');
  });

  it('throws for negative dollar discount (prevents overcharging)', () => {
    // Critical: negative amount_off would make totalAmount > subtotal
    expect(() =>
      calculateDealPurchaseTotals(
        makeDeal({ discountType: 'amount_off', discountValue: -5 }),
        makeServices(30)
      )
    ).toThrow(DealPurchasePricingError);
  });

  it('distributes discount proportionally across multiple services', () => {
    const result = calculateDealPurchaseTotals(
      makeDeal({ discountType: 'amount_off', discountValue: 20 }),
      makeServices(40, 60) // $100 total, $20 off
    );
    expect(result.totalAmount).toBe(8000); // $80
    expect(result.discountAmount).toBe(2000);
  });

  // Stripe minimum: $30 service with $29.60 off = $0.40 → below $0.50
  it('treats result below Stripe minimum ($0.50) as free', () => {
    const result = calculateDealPurchaseTotals(
      makeDeal({ discountType: 'amount_off', discountValue: 29.6 }),
      makeServices(30)
    );
    expect(result.totalAmount).toBe(0);
    expect(result.discountAmount).toBe(result.subtotalAmount);
  });

  it('total at exactly $0.50 is kept as chargeable', () => {
    const result = calculateDealPurchaseTotals(
      makeDeal({ discountType: 'amount_off', discountValue: 29.5 }),
      makeServices(30) // $30 - $29.50 = $0.50
    );
    expect(result.totalAmount).toBe(50); // 50 cents — exactly at Stripe minimum
  });
});

// ── free_service ───────────────────────────────────────────────────────────────

describe('calculateDealPurchaseTotals — free_service', () => {
  it('produces $0 total regardless of service price', () => {
    const result = calculateDealPurchaseTotals(
      makeDeal({ discountType: 'free_service', discountValue: 0 }),
      makeServices(120)
    );
    expect(result.totalAmount).toBe(0);
    expect(result.discountAmount).toBe(12000);
    expect(result.items[0].discountedUnitAmount).toBe(0);
  });
});

// ── resolveSelectedServicesForDeal edge cases ─────────────────────────────────

describe('resolveSelectedServicesForDeal', () => {
  const selectableServices = [
    { id: 'svc-1', name: 'Haircut', price: 50 },
    { id: 'svc-2', name: 'Color', price: 120 },
  ];
  const deal = makeDeal();

  it('rejects empty service selection', () => {
    expect(() =>
      resolveSelectedServicesForDeal(deal, selectableServices, [])
    ).toThrow('Select at least one service');
  });

  it('rejects duplicate service IDs', () => {
    expect(() =>
      resolveSelectedServicesForDeal(deal, selectableServices, ['svc-1', 'svc-1'])
    ).toThrow('only be selected once');
  });

  it('rejects service IDs not in selectable pool', () => {
    expect(() =>
      resolveSelectedServicesForDeal(deal, selectableServices, ['svc-999'])
    ).toThrow('not eligible');
  });

  it('rejects free_service deal with multiple services', () => {
    const freeDeal = makeDeal({ discountType: 'free_service' });
    expect(() =>
      resolveSelectedServicesForDeal(freeDeal, selectableServices, ['svc-1', 'svc-2'])
    ).toThrow('only include one service');
  });

  it('resolves valid service IDs correctly', () => {
    const result = resolveSelectedServicesForDeal(deal, selectableServices, ['svc-1']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('svc-1');
  });
});
