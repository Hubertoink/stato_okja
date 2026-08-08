import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_CATEGORIES } from '@/lib/defaultCategories';
import Toggle from '@/components/Toggle';
import {
  Category,
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useTaxonomyAccess,
  useUpdateCategory,
} from '@/lib/taxonomy';
import ConfirmModal from '@/components/ConfirmModal';
import { api } from '@/lib/api';
import { Pencil } from 'lucide-react';
import { CategoryFormModal } from '@/components/settings/EntityFormModals';
import { autoT } from '@/i18n/auto';
import { canManageSettingsDestructiveActions, useAuth } from '@/lib/auth';
import { DeleteIconButton } from '@/components/ui/Button';

export default function SettingsCategories() {
  const { user } = useAuth();
  const [showArchived, setShowArchived] = useState(false);
  const { data } = useCategories(showArchived ? undefined : { active: true });
  const { data: archivedOnly } = useCategories({ active: false });
  const { data: access } = useTaxonomyAccess();
  const archivedCount = (archivedOnly || []).length;
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const remove = useDeleteCategory();
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; category?: Category } | null>(null);
  const [confirm, setConfirm] = useState<{
    open: boolean;
    category?: Category;
    count?: number;
    loading?: boolean;
  }>({ open: false });
  const [seedConfirm, setSeedConfirm] = useState<{
    open: boolean;
    busy?: boolean;
    created?: number;
  }>({ open: false });
  const [selectedDefaultNames, setSelectedDefaultNames] = useState<string[]>([]);

  const categories = data || [];
  const canCreateOwn = access?.categories.canCreateOwn ?? true;
  const canDeleteTaxonomy = canManageSettingsDestructiveActions(user?.role);
  const allExisting = useMemo(
    () => [...(data || []), ...(archivedOnly || [])] as Category[],
    [data, archivedOnly],
  );

  const existingNames = useMemo(
    () => new Set(allExisting.map((c) => (c.name || '').trim().toLowerCase())),
    [allExisting],
  );
  const defaultsMissing = useMemo(
    () => DEFAULT_CATEGORIES.filter((c) => !existingNames.has(c.name.trim().toLowerCase())),
    [existingNames],
  );
  const selectedDefaultsMissing = useMemo(
    () => defaultsMissing.filter((c) => selectedDefaultNames.includes(c.name)),
    [defaultsMissing, selectedDefaultNames],
  );

  useEffect(() => {
    if (!seedConfirm.open) return;
    setSelectedDefaultNames((current) => {
      const availableNames = new Set(defaultsMissing.map((c) => c.name));
      const filtered = current.filter((name) => availableNames.has(name));
      return filtered.length > 0 ? filtered : defaultsMissing.map((c) => c.name);
    });
  }, [seedConfirm.open, defaultsMissing]);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h3 className="text-xl font-semibold text-viridian">{autoT('ui_dacba0c14909')}</h3>
          {!canCreateOwn && (
            <p className="taxonomy-lock-hint">{autoT('ui_881ee8504f25')}</p>
          )}
          <div className="text-xs text-gray-600 mt-1">
            <button
              type="button"
              className="text-viridian hover:underline disabled:text-gray-400"
              onClick={() => {
                if (!canCreateOwn) return;
                setSelectedDefaultNames(defaultsMissing.map((c) => c.name));
                setSeedConfirm({ open: true });
              }}
              disabled={!canCreateOwn || defaultsMissing.length === 0}
              title={
                !canCreateOwn
                  ? autoT('ui_006c7006dae2')
                  : defaultsMissing.length === 0
                  ? autoT('ui_ddd56354a8c9')
                  : undefined
              }
            >{autoT('ui_85373191e34a')}{defaultsMissing.length > 0 ? ` (${defaultsMissing.length})` : ''}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {archivedCount > 0 && (
            <Toggle
              checked={showArchived}
              onChange={setShowArchived}
              label={
                <span>{autoT('ui_d9431e38c8b6')}<span className="text-xs text-gray-500">({archivedCount})</span>
                </span>
              }
            />
          )}
          <span className="tooltip-wrapper">
            <button
              className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-viridian text-white hover:bg-cambridge-blue shadow disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => canCreateOwn && setModal({ mode: 'create' })}
              aria-label={autoT('ui_f65f5413c438')}
              title={autoT('ui_f65f5413c438')}
              disabled={!canCreateOwn}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-6 h-6"
              >
                <path
                  fillRule="evenodd"
                  d="M12 4.5a.75.75 0 01.75.75v6h6a.75.75 0 010 1.5h-6v6a.75.75 0 01-1.5 0v-6h-6a.75.75 0 010-1.5h6v-6A.75.75 0 0112 4.5z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <span className="tooltip-bubble">{autoT('ui_f65f5413c438')}</span>
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {categories.map((c) => {
          const isInherited = !!c.isInherited;
          const canManage = c.canManage !== false;
          return (
            <div key={c.id} className={`p-3 rounded border border-gray-200 flex items-center justify-between ${isInherited ? "bg-gray-50" : ''}`}>
              <div className="min-w-0 flex items-center gap-3">
                <span
                  className="inline-block h-4 w-4 rounded bg-slate-400"
                  style={{ backgroundColor: c.color || undefined }}
                />
                <div>
                  <div className="font-medium text-viridian flex items-center gap-2 flex-wrap">
                    <span>{c.name}</span>
                    {isInherited && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-cambridge-blue/15 text-cambridge-blue">{autoT('ui_a699c6f5aade')}{c.sourceOrgName ? ` aus ${c.sourceOrgName}` : ''}
                      </span>
                    )}
                  </div>
                  {c.description && (
                    <div className="text-sm text-gray-600 line-clamp-2">{c.description}</div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {showArchived && (c as Category).active === false && canManage && canDeleteTaxonomy && (
                  <button
                    className="text-viridian hover:underline"
                    onClick={() => update.mutate({ id: c.id, data: { active: true } })}
                  >{autoT('ui_98f492b5e015')}</button>
                )}
                {canManage && <button
                  className="opacity-90 hover:opacity-100 inline-flex items-center justify-center rounded-full bg-viridian/10 hover:bg-viridian/20 p-1.5"
                  title={autoT('ui_104f3bfdc340')}
                  aria-label={autoT('ui_fcff1db7c402', { value0: c.name })}
                  onClick={() => setModal({ mode: 'edit', category: c })}
                >
                  <Pencil className="w-4 h-4 text-viridian" />
                </button>}
                {canManage && canDeleteTaxonomy && <DeleteIconButton
                  size="icon-compact"
                  aria-label={autoT('ui_ffa5a8a7e21d')}
                  title={autoT('ui_ffa5a8a7e21d')}
                  onClick={async () => {
                    setConfirm({ open: true, category: c, loading: true });
                    try {
                      const res = await api.get('/activities', { params: { categoryIds: c.id, page: 1, limit: 1 } });
                      setConfirm({
                        open: true,
                        category: c,
                        count: Number(res.data?.total || 0),
                        loading: false,
                      });
                    } catch {
                      setConfirm((prv) => ({ ...prv, loading: false }));
                    }
                  }}
                />}
              </div>
            </div>
          );
        })}
        {categories.length === 0 && (
          <div className="text-gray-500 py-6">{autoT('ui_0b0bf37c9175')}</div>
        )}
      </div>

      {modal && (
        <CategoryFormModal
          initial={modal.mode === 'edit' ? modal.category : undefined}
          onSubmit={(values) => {
            if (modal.mode === 'create') {
              const color = values.color || '#7aa39a';
              create.mutate(
                { ...values, color, active: true },
                { onSuccess: () => setModal(null) },
              );
            } else if (modal.category?.id) {
              const { id: _r, ...rest } = (values || {}) as Partial<Category>;
              void _r;
              const color = rest.color || modal.category?.color || '#7aa39a';
              update.mutate(
                { id: modal.category.id, data: { ...rest, color } },
                { onSuccess: () => setModal(null) },
              );
            }
          }}
          onArchive={
            canDeleteTaxonomy && modal.mode === 'edit' && modal.category && modal.category.id
              ? () =>
                  update.mutate(
                    { id: modal.category!.id, data: { active: false } },
                    { onSuccess: () => setModal(null) },
                  )
              : undefined
          }
          onCancel={() => setModal(null)}
        />
      )}
      <ConfirmModal
        open={confirm.open}
        title={autoT('ui_9a14f7499249')}
        message={
          <div className="space-y-2">
            <p>{autoT('ui_e88ad590cc58')}</p>
            {confirm.loading ? (
              <p className="text-sm text-gray-500">{autoT('ui_7a67a2dd16a7')}</p>
            ) : (
              <p className="text-sm text-gray-700">{autoT('ui_8ae03f3803dd')}{' '}
                <strong>{typeof confirm.count === 'number' ? confirm.count : 0}</strong>
              </p>
            )}
            <p className="text-sm text-gray-600">{autoT('ui_bb97b7129505')}</p>
          </div>
        }
        cancelLabel={autoT('ui_07af7cb30fca')}
        secondaryLabel={autoT('ui_49471caa9c1f')}
        primaryAction="secondary"
        onSecondaryConfirm={() => {
          if (confirm.category?.id)
            update.mutate({ id: confirm.category.id, data: { active: false } });
          setConfirm({ open: false });
        }}
        confirmLabel={autoT('ui_9df6718de96c')}
        onConfirm={() => {
          if (confirm.category?.id) remove.mutate(confirm.category.id);
          setConfirm({ open: false });
        }}
        onCancel={() => setConfirm({ open: false })}
      />

      {/* Seed standard categories */}
      <ConfirmModal
        open={seedConfirm.open}
        title={autoT('ui_85373191e34a')}
        message={
          <div className="space-y-2 text-sm">
            {defaultsMissing.length > 0 ? (
              <>
                <p>{autoT('ui_3874c984ab37')}</p>
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-gray-500">
                    {selectedDefaultsMissing.length}{' '}{autoT('ui_445584edc4cc')}{' '}{defaultsMissing.length}{autoT('ui_1e8652188b4a')}</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="text-viridian hover:underline disabled:text-gray-400"
                      onClick={() => setSelectedDefaultNames(defaultsMissing.map((c) => c.name))}
                      disabled={selectedDefaultsMissing.length === defaultsMissing.length}
                    >{autoT('ui_4c7a986ffe2b')}</button>
                    <button
                      type="button"
                      className="text-gray-600 hover:underline disabled:text-gray-400"
                      onClick={() => setSelectedDefaultNames([])}
                      disabled={selectedDefaultsMissing.length === 0}
                    >{autoT('ui_3ce60e7427c1')}</button>
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                  {defaultsMissing.map((c) => {
                    const checked = selectedDefaultNames.includes(c.name);
                    return (
                      <label
                        key={c.name}
                        className="flex items-start gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-viridian focus:ring-viridian"
                          checked={checked}
                          onChange={(e) => {
                            setSelectedDefaultNames((current) =>
                              e.target.checked
                                ? [...current, c.name]
                                : current.filter((name) => name !== c.name),
                            );
                          }}
                        />
                        <span
                          className="mt-1 inline-block h-3.5 w-3.5 rounded bg-slate-400"
                          style={{ backgroundColor: c.color || undefined }}
                        />
                        <span className="min-w-0 flex-1 text-gray-800">{c.name}</span>
                      </label>
                    );
                  })}
                </div>
                {selectedDefaultsMissing.length === 0 && (
                  <p className="text-xs text-red-600">{autoT('ui_ed4b61a9a5b9')}</p>
                )}
              </>
            ) : (
              <p>{autoT('ui_cc7ded44ce8b')}</p>
            )}
          </div>
        }
        confirmLabel={seedConfirm.busy ? autoT('ui_75c41091cabe') : `${autoT('ui_dbc9fb8c7424')}${selectedDefaultsMissing.length > 0 ? ` (${selectedDefaultsMissing.length})` : ''}`}
        onConfirm={async () => {
          if (seedConfirm.busy) {
            return;
          }
          if (defaultsMissing.length === 0) {
            setSeedConfirm({ open: false });
            return;
          }
          if (selectedDefaultsMissing.length === 0) return;
          setSeedConfirm({ open: true, busy: true });
          try {
            for (const def of selectedDefaultsMissing) {
              await create.mutateAsync({ name: def.name, color: def.color, active: true });
            }
            setSeedConfirm({ open: false, busy: false, created: selectedDefaultsMissing.length });
          } catch {
            setSeedConfirm({ open: false, busy: false });
          }
        }}
        onCancel={() => setSeedConfirm({ open: false })}
        showCancel={true}
        cancelLabel={autoT('ui_07af7cb30fca')}
      />
    </div>
  );
}
