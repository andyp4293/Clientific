import { describe, expect, it } from 'vitest';
import { getPublicProfileVisibility } from './public-profile-visibility';

describe('getPublicProfileVisibility', () => {
  it('hides sections when toggles are false', () => {
    const visibility = getPublicProfileVisibility({
      publicProfileShowPhone: false,
      publicProfileShowEmail: false,
      publicProfileShowAddress: false,
      publicProfileShowHours: false,
      publicProfileShowServices: false,
      publicProfileShowTeam: false,
      publicProfileShowSocialLinks: false,
      phone: '5551112222',
      businessEmail: 'owner@test.com',
      street: '1 Main St',
      city: 'Brick',
      state: 'NJ',
    });

    expect(visibility).toEqual({
      showPhone: false,
      showEmail: false,
      showAddress: false,
      showHours: false,
      showServices: false,
      showTeam: false,
      showSocialLinks: false,
    });
  });

  it('respects data presence for contact fields', () => {
    const visibility = getPublicProfileVisibility({
      publicProfileShowPhone: true,
      publicProfileShowEmail: true,
      publicProfileShowAddress: true,
      publicProfileShowHours: true,
      publicProfileShowServices: true,
      publicProfileShowTeam: true,
      publicProfileShowSocialLinks: true,
      phone: null,
      businessEmail: 'owner@test.com',
      street: '1 Main St',
      city: 'Brick',
      state: 'NJ',
    });

    expect(visibility.showPhone).toBe(false);
    expect(visibility.showEmail).toBe(true);
    expect(visibility.showAddress).toBe(true);
  });
});
