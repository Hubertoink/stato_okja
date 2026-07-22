import { Loader2 } from 'lucide-react';
import Modal from './Modal';

export default function ExportProgressModal({
  message,
}: {
  /** A non-empty message keeps the progress dialog visible. */
  message: string | null;
}) {
  return (
    <Modal
      open={message !== null}
      onClose={() => undefined}
      title="Export wird erstellt"
      maxWidth="sm"
      showCloseButton={false}
    >
      <div className="space-y-4 py-1" role="status" aria-live="polite" aria-atomic="true">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-azure-web text-viridian">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900">Bitte einen Moment warten</p>
            <p className="mt-1 text-sm leading-6 text-gray-600">{message}</p>
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
          <div className="h-full w-2/3 rounded-full bg-viridian animate-pulse" />
        </div>
        <p className="text-xs leading-5 text-gray-500">
          Je nach Datenmenge kann der Download einige Sekunden dauern. Das Fenster schließt sich automatisch.
        </p>
      </div>
    </Modal>
  );
}
