import { useEffect, useRef, useState } from 'react';
import logoUrl from '../../assets/Stato_Logo.png';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';

const MIN_VISIBLE_MS = 1250;

export default function DemoSplashScreen({
  open,
  message = 'Demo-Daten werden vorbereitet...',
  progress,
}: {
  open: boolean;
  message?: string;
  progress?: { current: number; total: number };
}) {
  const [visible, setVisible] = useState(true);
  const visibleSinceRef = useRef(Date.now());

  useBodyScrollLock(visible);

  useEffect(() => {
    if (open) {
      visibleSinceRef.current = Date.now();
      setVisible(true);
      return undefined;
    }

    const elapsed = Date.now() - visibleSinceRef.current;
    const timeoutId = window.setTimeout(
      () => setVisible(false),
      Math.max(0, MIN_VISIBLE_MS - elapsed),
    );

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [open]);

  if (!visible) return null;

  const pct = (() => {
    if (!progress) return null;
    const total = Math.max(0, progress.total);
    const current = Math.max(0, Math.min(progress.current, total));
    if (total <= 0) return null;
    return Math.round((current / total) * 100);
  })();

  return (
    <div className="demo-splash fixed inset-0 z-[90] flex items-center justify-center px-6" role="status" aria-live="polite">
      <div className="demo-splash-stage w-full max-w-sm text-center">
        <div className="demo-splash-logo-wrap mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-[1.75rem] bg-white shadow-lg">
          <img src={logoUrl} alt="StatO" className="demo-splash-logo h-16 w-16 object-contain" />
        </div>
        <div className="text-sm font-semibold uppercase tracking-[0.24em] text-white/70">StatO Demo</div>
        <div className="mt-2 text-2xl font-bold text-white">Wird vorbereitet</div>
        <div className="mt-2 min-h-[1.25rem] text-sm text-white/80">{message}</div>
        <div className="demo-splash-progress mt-6" aria-hidden>
          <span
            className={pct === null ? 'demo-splash-progress-bar demo-splash-progress-bar-indeterminate' : 'demo-splash-progress-bar'}
            style={pct === null ? undefined : { width: `${pct}%` }}
          />
        </div>
        <div className="mt-4 flex justify-center gap-1.5" aria-hidden>
          <span className="demo-splash-dot" />
          <span className="demo-splash-dot demo-splash-dot-delay-1" />
          <span className="demo-splash-dot demo-splash-dot-delay-2" />
        </div>
      </div>
    </div>
  );
}
