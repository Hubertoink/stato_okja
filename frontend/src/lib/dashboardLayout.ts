import { useEffect, useState } from 'react';

export const DASHBOARD_SECTIONS = [
  'openingHours', 'quickActions', 'surveys', 'logbook', 'dailyLog',
  'trend', 'annualTargets', 'customKpis', 'recentActions',
] as const;
export type DashboardSectionId = typeof DASHBOARD_SECTIONS[number];
const CHANGE_EVENT = 'stato:dashboard-layout';
const storageKey = (userId?: string) => `dashboard_layout_v1:${userId || 'anonymous'}`;

export function normalizeDashboardLayout(value: unknown): DashboardSectionId[] {
  const valid = Array.isArray(value)
    ? value.filter((id): id is DashboardSectionId => DASHBOARD_SECTIONS.includes(id))
    : [];
  return [...new Set([...valid, ...DASHBOARD_SECTIONS])];
}

export function loadDashboardLayout(userId?: string): DashboardSectionId[] {
  try {
    return normalizeDashboardLayout(JSON.parse(localStorage.getItem(storageKey(userId)) || 'null'));
  } catch {
    return [...DASHBOARD_SECTIONS];
  }
}

export function saveDashboardLayout(order: readonly DashboardSectionId[], userId?: string): boolean {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(normalizeDashboardLayout(order)));
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function useDashboardLayout(userId?: string) {
  const [order, setOrder] = useState(() => loadDashboardLayout(userId));
  useEffect(() => {
    const sync = () => setOrder(loadDashboardLayout(userId));
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [userId]);
  return order;
}
