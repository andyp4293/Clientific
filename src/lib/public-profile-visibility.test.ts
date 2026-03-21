import { describe, expect, it } from 'vitest';
import { getPublicProfileVisibility } from './public-profile-visibility';

describe('getPublicProfileVisibility', () => {
  it('hides sections when toggles are false', () => {
    const visibility = getPublicProfileVisibility({
      publicProfileShowAddress: false,
      publicProfileShowHours: false,
      publicProfileShowServices: false,
      publicProfileShowTeam: false,
      publicProfileShowSocialLinks: false,
      street: '1 Main St',
      city: 'Brick',
      state: 'NJ',
    });

    expect(visibility).toEqual({
      showAddress: false,
      showHours: false,
      showServices: false,
      showTeam: false,
      showSocialLinks: false,
    });
  });

  it('only shows location when address data is complete', () => {
    const visibility = getPublicProfileVisibility({
      publicProfileShowAddress: true,
      publicProfileShowHours: true,
      publicProfileShowServices: true,
      publicProfileShowTeam: true,
      publicProfileShowSocialLinks: true,
      street: '1 Main St',
      city: 'Brick',
      state: 'NJ',
    });

    expect(visibility.showAddress).toBe(true);
  });

  it('hides location when the address is incomplete', () => {
    const visibility = getPublicProfileVisibility({
      publicProfileShowAddress: true,
      publicProfileShowHours: true,
      publicProfileShowServices: true,
      publicProfileShowTeam: true,
      publicProfileShowSocialLinks: true,
      street: '1 Main St',
      city: null,
      state: 'NJ',
    });

    expect(visibility.showAddress).toBe(false);
  });
});
