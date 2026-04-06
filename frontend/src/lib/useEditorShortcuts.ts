import { useEffect } from 'react';

type UseEditorShortcutsOptions = {
  enabled?: boolean;
  onClose?: () => void;
  onSave?: () => void;
};

export function useEditorShortcuts({
  enabled = true,
  onClose,
  onSave,
}: UseEditorShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return;

      if (
        event.key === 'Escape' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey
      ) {
        if (!onClose) return;
        event.preventDefault();
        onClose();
        return;
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        event.key.toLowerCase() === 's'
      ) {
        if (!onSave) return;
        event.preventDefault();
        event.stopPropagation();
        onSave();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [enabled, onClose, onSave]);
}