import { Button } from './ui/Button';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useOrganizationModules, type OrganizationModule } from '@/lib/organizationModules';

export default function OrganizationModuleRoute({ module, children }: { module: OrganizationModule; children: ReactNode }) {
  const access = useOrganizationModules();
  if (access.isPending) return <p className="p-6" role="status">Module werden geladen …</p>;
  if (access.isError) return <div className="p-6" role="alert">Die Modulfreigabe konnte nicht geladen werden. <Button variant="ghost" className="underline" onClick={() => void access.refetch()}>Erneut versuchen</Button></div>;
  if (!access.data?.[module]) return (
    <div className="p-6">
      <h2 className="text-xl font-semibold">Modul deaktiviert</h2>
      <p className="mt-2">Dieses Modul ist für die Organisation nicht freigeschaltet. Vorhandene Daten bleiben erhalten.</p>
      <Link className="mt-4 inline-block underline" to="/dashboard">Zum Dashboard</Link>
    </div>
  );
  return children;
}
