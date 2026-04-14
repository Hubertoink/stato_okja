import { useEffect, useState } from 'react';
import { useIsMobile } from '@/lib/useIsMobile';

const STORAGE_KEY = 'stato.activity-modal-count-mode';

export function useActivityModalCountMode() {
  const isMobile = useIsMobile(768);
  const [tapModePreferred, setTapModePreferred] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(STORAGE_KEY) === 'tap';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, tapModePreferred ? 'tap' : 'input');
    } catch {
      // Ignore storage errors and keep the in-memory preference.
    }
  }, [tapModePreferred]);

  return {
    isMobile,
    tapModePreferred,
    tapModeEnabled: isMobile && tapModePreferred,
    setTapModePreferred,
  };
}