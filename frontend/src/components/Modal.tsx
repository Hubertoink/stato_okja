import { X as XIcon } from 'lucide-react';
import React from 'react';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';

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
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
}) {
  // Lock background scroll when modal is open
  useBodyScrollLock(open);
  if (!open) return null;
  const maxW = { sm: 'md:max-w-sm', md: 'md:max-w-md', lg: 'md:max-w-lg', xl: 'md:max-w-xl', '2xl': 'md:max-w-2xl', '3xl': 'md:max-w-3xl', '4xl': 'md:max-w-4xl' }[
    maxWidth
  ];
  return (
    <div
      className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6 modal-overlay"
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        className={`bg-white/95 backdrop-blur-xl w-full ${maxW} rounded-t-3xl md:rounded-2xl p-4 md:p-6 max-h-[85vh] overflow-y-auto bottom-sheet-animate shadow-2xl border border-white/50`}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold gradient-text">{title}</h3>
          <button
            className="inline-flex items-center justify-center p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 transition-all duration-200 hover:scale-105"
            onClick={onClose}
            aria-label="Schließen"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
