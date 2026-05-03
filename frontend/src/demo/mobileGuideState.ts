import { useSyncExternalStore } from 'react';

let guidesMutedForPageLoad = false;
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return guidesMutedForPageLoad;
}

export function useDemoMobileGuideMuted() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function setDemoMobileGuideMuted(nextMuted: boolean) {
  if (guidesMutedForPageLoad === nextMuted) return;
  guidesMutedForPageLoad = nextMuted;
  emitChange();
}
