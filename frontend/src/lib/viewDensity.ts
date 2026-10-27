export type ViewDensity = 'normal' | 'compact';

const STORAGE_KEY = 'stato_view_density_v1';

export function normalizeViewDensity(value?: string | null): ViewDensity {
  return value === 'normal' ? 'normal' : 'compact';
}

export function applyViewDensity(value?: string | null) {
  const density = normalizeViewDensity(value);
  document.documentElement.dataset.viewDensity = density;
  try {
    window.localStorage.setItem(STORAGE_KEY, density);
  } catch {
    // The account preference still applies when browser storage is unavailable.
  }
}

export function applyStoredViewDensity() {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Use the default until the account preference is loaded.
  }
  applyViewDensity(stored);
}
