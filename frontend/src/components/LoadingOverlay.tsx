import { useBodyScrollLock } from '@/lib/useBodyScrollLock';

export default function LoadingOverlay({
  open,
  title = 'Lädt…',
  message = 'Daten werden vorbereitet…',
  progress,
}: {
  open: boolean;
  title?: string;
  message?: string;
  progress?: { current: number; total: number };
}) {
  useBodyScrollLock(open);
  if (!open) return null;

  const pct = (() => {
    if (!progress) return null;
    const total = Math.max(0, progress.total);
    const current = Math.max(0, Math.min(progress.current, total));
    if (total <= 0) return null;
    return Math.round((current / total) * 100);
  })();

  return (
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
      <div
        className="bg-white w-full max-w-md rounded-xl shadow-lg p-5"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-5 h-5 rounded-full border-2 border-viridian/30 border-t-viridian animate-spin"
            aria-hidden
          />
          <div className="min-w-0">
            <div className="font-semibold text-viridian truncate">{title}</div>
            <div className="text-sm text-gray-600 mt-0.5">{message}</div>
          </div>
        </div>

        {pct !== null && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
              <span>Initialisierung</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full bg-viridian transition-[width] duration-200"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
