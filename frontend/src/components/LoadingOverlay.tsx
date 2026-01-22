import { useBodyScrollLock } from '@/lib/useBodyScrollLock';

export default function LoadingOverlay({
  open,
  title = 'Lädt…',
  message = 'Daten werden vorbereitet…',
}: {
  open: boolean;
  title?: string;
  message?: string;
}) {
  useBodyScrollLock(open);
  if (!open) return null;

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
      </div>
    </div>
  );
}
