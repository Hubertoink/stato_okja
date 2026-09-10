import { useEffect, useRef } from 'react';

type ActivityListPosition = { page: number; y: number };
const positions = new Map<string, ActivityListPosition>();

export function getActivityListPosition(key: string) {
  return positions.get(key);
}

export function saveActivityListPosition(key: string, page: number) {
  positions.set(key, {
    page,
    y: Math.max(window.scrollY || 0, document.scrollingElement?.scrollTop || 0),
  });
  // Retain recent history entries without growing for the lifetime of the app.
  if (positions.size > 50) positions.delete(positions.keys().next().value!);
}

export function useRestoreActivityListPosition(position: ActivityListPosition | undefined, ready: boolean) {
  const restored = useRef(false);
  useEffect(() => {
    if (!position || !ready || restored.current) return;
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: position.y, left: 0, behavior: 'auto' });
      if (document.scrollingElement) document.scrollingElement.scrollTop = position.y;
      restored.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [position, ready]);
}
