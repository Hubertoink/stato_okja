import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/Toast';

export interface DesktopUpdateState {
  revision: number;
  status: 'idle' | 'disabled' | 'checking' | 'current' | 'available' | 'downloading' | 'downloaded' | 'installing' | 'error';
  currentVersion: string;
  version: string | null;
  percent: number;
}

declare global {
  interface Window {
    statoDesktopUpdates?: {
      getState: () => Promise<DesktopUpdateState>;
      open: () => Promise<DesktopUpdateState>;
      onState: (callback: (state: DesktopUpdateState) => void) => () => void;
    };
  }
}

export function useDesktopUpdates() {
  const bridge = window.statoDesktopUpdates;
  const [state, setState] = useState<DesktopUpdateState | null>(null);
  const { showToast } = useToast();
  const notified = useRef(new Set<string>());
  useEffect(() => {
    if (!bridge) return;
    let active = true;
    let revision = -1;
    const receive = (next: DesktopUpdateState) => {
      if (!active || next.revision < revision) return;
      revision = next.revision;
      setState(next);
      const key = `${next.status}:${next.version}`;
      if (['available', 'downloaded'].includes(next.status) && !notified.current.has(key)) {
        notified.current.add(key);
        showToast(next.status === 'available'
          ? `StatO Desktop ${next.version} ist verfügbar. Öffne „Desktop-Updates“ im Avatar-Menü.`
          : `StatO Desktop ${next.version} ist bereit. Starte die Installation über „Desktop-Updates“.`,
        { type: 'info', durationMs: 10000 });
      }
    };
    const unsubscribe = bridge.onState(receive);
    void bridge.getState().then(receive).catch(() => {});
    return () => { active = false; unsubscribe(); };
  }, [bridge, showToast]);
  return {
    available: Boolean(bridge),
    state,
    open: () => {
      void bridge?.open().catch(() => showToast('Desktop-Updates konnten nicht geöffnet werden.', { type: 'error' }));
    },
  };
}
