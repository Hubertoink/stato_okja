import { X as XIcon } from 'lucide-react';
import React from 'react';

export default function Modal({
  open,
  title,
  children,
  onClose,
  maxWidth = 'md',
}: {
  open: boolean;
  title?: string;
  children: React.ReactNode;
  onClose: () => void;
  maxWidth?: 'sm'|'md'|'lg'|'xl';
}) {
  if (!open) return null;
  const maxW = { sm:'md:max-w-sm', md:'md:max-w-md', lg:'md:max-w-lg', xl:'md:max-w-xl' }[maxWidth];
  return (
    <div className="fixed inset-0 z-[70] bg-black/30 flex items-end md:items-center justify-center p-0 md:p-6">
      <div className={`bg-white w-full ${maxW} rounded-t-2xl md:rounded-lg p-4 md:p-6 max-h-[85vh] overflow-y-auto bottom-sheet-animate`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-viridian">{title}</h3>
          <button className="inline-flex items-center justify-center p-2 rounded-full bg-gray-200 text-gray-700" onClick={onClose} aria-label="Schließen">
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
