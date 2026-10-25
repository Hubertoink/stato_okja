import { beforeEach, describe, expect, it } from 'vitest';
import { getMobileNavLayout, MOBILE_NAV_ITEM_IDS, saveMobileNavLayout } from './mobileNavigation';

describe('mobile navigation with master data and operations', () => {
  beforeEach(() => localStorage.clear());
  it('preserves the existing bottom selection while making new sections available', () => {
    expect(getMobileNavLayout('user').bottom).toEqual([
      'dashboard',
      'activities',
      'logbook',
      'calendar',
    ]);
    expect(MOBILE_NAV_ITEM_IDS).toContain('masterData');
    expect(MOBILE_NAV_ITEM_IDS).toContain('operations');
    saveMobileNavLayout(
      { bottom: ['dashboard', 'activities', 'masterData', 'operations'] },
      'user',
    );
    expect(getMobileNavLayout('user').bottom).toEqual([
      'dashboard',
      'activities',
      'masterData',
      'operations',
    ]);
  });
  it('fills the four positions with available modules only', () => {
    const available = MOBILE_NAV_ITEM_IDS.filter((id) => id !== 'logbook' && id !== 'surveys');
    const layout = getMobileNavLayout('user', available);
    expect(layout.bottom).toHaveLength(4);
    expect(layout.bottom).not.toContain('logbook');
  });
});
