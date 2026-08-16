export const MOBILE_NAV_ITEM_IDS = ['dashboard', 'activities', 'logbook', 'calendar', 'projects', 'processes', 'surveys', 'statistics', 'settings'] as const;
export type MobileNavItemId = typeof MOBILE_NAV_ITEM_IDS[number];
export type MobileNavLayout = { bottom: MobileNavItemId[] };

const DEFAULT_LAYOUT: MobileNavLayout = { bottom: ['dashboard', 'activities', 'logbook', 'calendar'] };

function key(userId?: string | null) { return `mobile_nav_layout_v1:${userId || 'anonymous'}`; }

export function getMobileNavLayout(userId?: string | null, availableItemIds: readonly MobileNavItemId[] = MOBILE_NAV_ITEM_IDS): MobileNavLayout {
  try {
    const raw = localStorage.getItem(key(userId));
    const parsed = raw ? JSON.parse(raw) as Partial<MobileNavLayout> : null;
    const valid = Array.isArray(parsed?.bottom) ? parsed.bottom.filter((id): id is MobileNavItemId => availableItemIds.includes(id as MobileNavItemId)) : [];
    const unique = Array.from(new Set(valid));
    if (unique.length === 4) return { bottom: unique };
  } catch { /* defaults */ }
  return { ...DEFAULT_LAYOUT };
}

export function saveMobileNavLayout(layout: MobileNavLayout, userId?: string | null, availableItemIds: readonly MobileNavItemId[] = MOBILE_NAV_ITEM_IDS) {
  const bottom = Array.from(new Set(layout.bottom)).filter((id): id is MobileNavItemId => availableItemIds.includes(id)).slice(0, 4);
  if (bottom.length !== 4) return;
  try {
    localStorage.setItem(key(userId), JSON.stringify({ bottom }));
    window.dispatchEvent(new CustomEvent('stato:mobile-nav-layout', { detail: { userId, bottom } }));
  } catch { /* ignore storage failures */ }
}

export function resetMobileNavLayout(userId?: string | null, availableItemIds: readonly MobileNavItemId[] = MOBILE_NAV_ITEM_IDS) {
  try { localStorage.removeItem(key(userId)); } catch { /* ignore */ }
  saveMobileNavLayout(DEFAULT_LAYOUT, userId, availableItemIds);
}
