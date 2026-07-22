import { useEffect, useState } from 'react';
import { Save, Settings2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import type { AccountProvisioningPolicy } from '@/lib/publicConfig';

type SettingsDto = {
  orgName: string | null;
  loginSubtitle: string;
  accountProvisioningPolicy: AccountProvisioningPolicy;
};

export default function SuperAdminSystemSettings() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [settings, setSettings] = useState<SettingsDto | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void api.get<SettingsDto>('/system-settings').then((result) => setSettings(result.data)).catch(() => {
      showToast('Systemeinstellungen konnten nicht geladen werden.', { type: 'error' });
    });
  }, [showToast]);

  if (!user || user.role !== 'superadmin') return null;
  if (!settings) return <div className="p-6 text-sm text-gray-500">Systemeinstellungen werden geladen…</div>;

  const update = <K extends keyof SettingsDto>(key: K, value: SettingsDto[K]) => setSettings((current) => current ? { ...current, [key]: value } : current);
  const save = async () => {
    setSaving(true);
    try {
      const result = await api.patch<SettingsDto>('/system-settings', settings);
      setSettings(result.data);
      showToast('Systemeinstellungen gespeichert.', { type: 'success' });
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message || 'Speichern fehlgeschlagen.';
      showToast(String(message), { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-3 sm:px-4">
      <div className="mb-6">
        <h2 className="flex items-center gap-2 text-2xl font-bold text-viridian"><Settings2 className="h-6 w-6" /> Systemeinstellungen</h2>
        <p className="mt-1 text-sm text-gray-600">Diese Angaben gelten installationsweit. Geheimnisse und technische Verbindungsdaten bleiben ausschließlich in der Deployment-Konfiguration.</p>
      </div>
      <div className="space-y-5 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Organisationsname im Login</label>
          <input value={settings.orgName || ''} onChange={(event) => update('orgName', event.target.value || null)} placeholder="z. B. Jugendhaus Musterstadt" className="w-full rounded-lg border px-3 py-2 focus:border-viridian focus:ring-2 focus:ring-viridian" />
          <p className="mt-1 text-xs text-gray-500">Leer lassen, um den Deployment-Standard zu verwenden.</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Login-Untertitel</label>
          <input value={settings.loginSubtitle} onChange={(event) => update('loginSubtitle', event.target.value)} className="w-full rounded-lg border px-3 py-2 focus:border-viridian focus:ring-2 focus:ring-viridian" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Benutzerbereitstellung</label>
          <select value={settings.accountProvisioningPolicy} onChange={(event) => update('accountProvisioningPolicy', event.target.value as AccountProvisioningPolicy)} className="w-full rounded-lg border px-3 py-2 focus:border-viridian focus:ring-2 focus:ring-viridian">
            <option value="admin_password">Nur durch Admin mit Startpasswort</option>
            <option value="invite">Nur per E-Mail-Einladung</option>
            <option value="both">Beide Verfahren erlauben</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">Bei „Startpasswort“ ist kein Mailserver für Anlage oder Passwortwechsel notwendig.</p>
        </div>
        <div className="flex justify-end border-t pt-4">
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-viridian px-4 py-2 text-white disabled:opacity-60"><Save className="h-4 w-4" />{saving ? 'Speichert…' : 'Speichern'}</button>
        </div>
      </div>
    </div>
  );
}
