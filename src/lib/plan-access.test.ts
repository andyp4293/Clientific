import { describe, expect, it } from 'vitest';
import {
  AI_RECEPTIONIST_REQUIRED_PLAN,
  canAccessAiReceptionist,
  hasPlanAccess,
  requiresPlanUpgrade,
} from './plan-access';

describe('plan access helpers', () => {
  it('keeps AI receptionist on Pro and Premium only', () => {
    expect(AI_RECEPTIONIST_REQUIRED_PLAN).toBe('pro');
    expect(canAccessAiReceptionist('trial')).toBe(false);
    expect(canAccessAiReceptionist('starter')).toBe(false);
    expect(canAccessAiReceptionist('base')).toBe(false);
    expect(canAccessAiReceptionist('pro')).toBe(true);
    expect(canAccessAiReceptionist('premium')).toBe(true);
  });

  it('reports upgrade requirements across the plan hierarchy', () => {
    expect(requiresPlanUpgrade('starter', 'pro')).toBe(true);
    expect(requiresPlanUpgrade('pro', 'pro')).toBe(false);
    expect(requiresPlanUpgrade('premium', 'pro')).toBe(false);
  });

  it('supports generic plan access checks', () => {
    expect(hasPlanAccess('starter', 'starter')).toBe(true);
    expect(hasPlanAccess('starter', 'premium')).toBe(false);
    expect(hasPlanAccess('premium', 'starter')).toBe(true);
  });
});
