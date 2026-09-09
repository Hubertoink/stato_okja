import { Button } from './ui/Button';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Layers } from 'lucide-react';
import Toggle from './Toggle';
import type { OrgDto } from '@/lib/orgs';
import type { OrganizationModule } from '@/lib/organizationModules';

const modules: Array<{ id: OrganizationModule; label: string }> = [
  { id: 'processes', label: 'ProzessO' },
  { id: 'logbook', label: 'Logbuch' },
  { id: 'surveys', label: 'Umfragen' },
];

export default function OrganizationModulesMenu({ org, onChange }: {
  org: OrgDto;
  onChange: (orgId: string, module: OrganizationModule, enabled: boolean) => Promise<void>;
}) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!position) return;
    panel.current?.querySelector<HTMLElement>('button, input')?.focus();
    const outside = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setPosition(null);
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setPosition(null); trigger.current?.focus(); }
    };
    const close = () => setPosition(null);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', keydown);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', keydown);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close);
    };
  }, [position]);

  return <>
    <Button variant="secondary" size="sm" type="button" aria-expanded={!!position} aria-controls={position ? id : undefined}
      aria-label={`Module für ${org.name}`} aria-haspopup="dialog"
      className="org-tree-action-button inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium"
      onClick={(event) => {
        event.stopPropagation();
        trigger.current = event.currentTarget;
        if (position) { setPosition(null); return; }
        const rect = event.currentTarget.getBoundingClientRect();
        setPosition({ top: Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - 280)), left: Math.max(8, Math.min(rect.right - 288, window.innerWidth - 296)) });
      }}>
      <Layers className="h-4 w-4" /><span>Module</span><ChevronDown className="h-3.5 w-3.5" />
    </Button>
    {position && createPortal(<div ref={panel} id={id} role="dialog" aria-label={`Module für ${org.name}`}
      className="fixed max-h-[calc(100dvh-1rem)] overflow-y-auto z-[80] w-72 max-w-[calc(100vw-1rem)] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4 text-[var(--text-primary)] shadow-xl"
      style={position} onClick={(event) => event.stopPropagation()}>
      <p className="mb-3 truncate text-sm font-semibold">Module · {org.name}</p>
      <div className="space-y-3">
        {modules.map(({ id: module, label }) => <Toggle key={module} label={label} className="w-full"
          checked={org[`${module}Enabled`] === true} disabled={saving}
          ariaLabel={`${label} für ${org.name}`}
          onChange={(enabled) => {
            setSaving(true);
            void onChange(org.id, module, enabled).finally(() => setSaving(false));
          }} />)}
      </div>
      <p className="mt-4 text-xs text-[var(--text-secondary)]">Gilt nur für diese Organisation. Beim Deaktivieren bleiben alle Daten erhalten.</p>
    </div>, document.body)}
  </>;
}
