import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useOrgScopeKey } from '@/lib/orgScope';
import type { AnnualTarget } from '@/lib/annualTargets';
import AnnualTargetCards from './AnnualTargetCards';
import { TargetDetail, TargetEditor } from './AnnualTargetDialogs';

export default function DashboardAnnualTargets() {
  const scopeKey = useOrgScopeKey();
  return <DashboardTargetsContent key={scopeKey} />;
}

function DashboardTargetsContent() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'org_admin' || user?.role === 'superadmin';
  const [selected, setSelected] = useState<AnnualTarget | null>(null);
  const [editor, setEditor] = useState<AnnualTarget | null>(null);
  return (
    <>
      <AnnualTargetCards onOpen={setSelected} />
      {selected && !editor && (
        <TargetDetail
          key={selected.id}
          id={selected.id}
          isAdmin={isAdmin}
          onClose={() => setSelected(null)}
          onEdit={setEditor}
        />
      )}
      {editor && isAdmin && (
        <TargetEditor
          initial={editor}
          year={editor.year}
          scope={editor.scope}
          onClose={() => setEditor(null)}
          onSaved={() => setEditor(null)}
        />
      )}
    </>
  );
}
