import { useState, type Dispatch, type SetStateAction } from 'react';
import { CategoryFormModal, StaffFormModal, TagFormModal } from '@/components/settings/EntityFormModals';
import type { StaffRole } from '@/lib/staff';
import type { ActivityFormState } from './activityEditorShared';
import { appendUniqueId, findNamedEntity } from './activityEditorShared';
import { autoT } from '@/i18n/auto';

type ToastType = 'success' | 'error' | 'info';
type ToastFn = (message: string, opts?: { type?: ToastType; durationMs?: number }) => void;

type NamedRecord = {
  id: string;
  name: string;
  active?: boolean;
};

type CategoryRecord = NamedRecord & {
  description?: string | null;
  standardRef?: string | null;
  color?: string | null;
};

type TagRecord = NamedRecord & {
  description?: string | null;
  color?: string | null;
};

type StaffRecord = NamedRecord;

type Mutation<TInput, TResult> = {
  mutateAsync: (input: TInput) => Promise<TResult>;
};

type TaxonomyAccess = {
  tags?: { canCreateOwn?: boolean };
  categories?: { canCreateOwn?: boolean };
} | null | undefined;

type CurrentUser = {
  role?: string | null;
} | null | undefined;

type CategoryValues = {
  name?: string;
  description?: string | null;
  standardRef?: string | null;
  color?: string | null;
};

type TagValues = {
  name?: string;
  description?: string | null;
  color?: string | null;
};

type StaffValues = {
  name?: string;
  roles?: StaffRole[] | StaffRole;
};

type UseActivityInlineCreationOptions = {
  allCategories?: CategoryRecord[];
  allTags?: TagRecord[];
  allStaff?: StaffRecord[];
  taxonomyAccess?: TaxonomyAccess;
  user?: CurrentUser;
  setForm: Dispatch<SetStateAction<ActivityFormState>>;
  showToast: ToastFn;
  createCategory: Mutation<Partial<CategoryRecord>, CategoryRecord>;
  updateCategory: Mutation<{ id: string; data: Partial<CategoryRecord> }, unknown>;
  createTag: Mutation<Partial<TagRecord>, TagRecord>;
  updateTag: Mutation<{ id: string; data: Partial<TagRecord> }, unknown>;
  createStaff: Mutation<StaffValues, StaffRecord>;
};

export function useActivityInlineCreation({
  allCategories,
  allTags,
  allStaff,
  taxonomyAccess,
  user,
  setForm,
  showToast,
  createCategory,
  updateCategory,
  createTag,
  updateTag,
  createStaff,
}: UseActivityInlineCreationOptions) {
  const [tagCreateOpen, setTagCreateOpen] = useState(false);
  const [categoryCreateOpen, setCategoryCreateOpen] = useState(false);
  const [staffCreateState, setStaffCreateState] = useState<{ open: boolean; role: StaffRole }>({
    open: false,
    role: 'employee',
  });

  const canCreateOwnTags = Boolean(taxonomyAccess?.tags?.canCreateOwn);
  const canCreateOwnCategories = Boolean(taxonomyAccess?.categories?.canCreateOwn);
  const canManageStaff = Boolean(user && (user.role === 'superadmin' || user.role === 'org_admin'));
  const addActionButtonClassName =
    'inline-flex items-center gap-1 text-sm font-medium text-viridian transition-colors hover:text-viridian/80';

  const addStaffId = (staffId: string) => {
    setForm((current) => ({ ...current, staffIds: appendUniqueId(current.staffIds, staffId) }));
  };

  const handleCategoryCreate = async (values: CategoryValues) => {
    const name = String(values.name || '').trim();
    if (!name) return;
    const existing = findNamedEntity(allCategories, name);

    try {
      let categoryId = existing?.id;
      const color = values.color || '#7aa39a';

      if (existing?.id && existing.active === false) {
        await updateCategory.mutateAsync({
          id: existing.id,
          data: { active: true, description: values.description, standardRef: values.standardRef, color },
        });
      } else if (!existing?.id) {
        const created = await createCategory.mutateAsync({
          name,
          active: true,
          description: values.description,
          standardRef: values.standardRef,
          color,
        });
        categoryId = created.id;
      }

      if (!categoryId) throw new Error('missing-category-id');
      setForm((current) => ({ ...current, categoryIds: appendUniqueId(current.categoryIds, categoryId) }));
      showToast(
        existing?.id ? `Kategorie "${name}" wurde zugeordnet.` : autoT('ui_1335fd92fa57', { value0: name }),
        existing?.id ? { type: 'info' } : undefined,
      );
      setCategoryCreateOpen(false);
    } catch {
      showToast(autoT('ui_0e7e0d8eb6c9'), { type: 'error' });
    }
  };

  const handleTagCreate = async (values: TagValues) => {
    const name = String(values.name || '').trim();
    if (!name) return;
    const existing = findNamedEntity(allTags, name);

    try {
      let tagId = existing?.id;
      const color = values.color || '#7aa39a';

      if (existing?.id && existing.active === false) {
        await updateTag.mutateAsync({
          id: existing.id,
          data: { active: true, description: values.description, color },
        });
      } else if (!existing?.id) {
        const created = await createTag.mutateAsync({
          name,
          active: true,
          description: values.description,
          color,
        });
        tagId = created.id;
      }

      if (!tagId) throw new Error('missing-tag-id');
      setForm((current) => ({ ...current, tagIds: appendUniqueId(current.tagIds, tagId) }));
      showToast(
        existing?.id ? `Tag "${name}" wurde zugeordnet.` : autoT('ui_5a6837b1f831', { value0: name }),
        existing?.id ? { type: 'info' } : undefined,
      );
      setTagCreateOpen(false);
    } catch {
      showToast(autoT('ui_2cdd45e69756'), { type: 'error' });
    }
  };

  const handleStaffCreate = async (values: StaffValues) => {
    const name = String(values.name || '').trim();
    if (!name) return;
    const existing = findNamedEntity(allStaff, name);

    if (existing?.id) {
      addStaffId(existing.id);
      showToast(`Teammitglied "${existing.name}" wurde zugeordnet.`, { type: 'info' });
      setStaffCreateState((current) => ({ ...current, open: false }));
      return;
    }

    try {
      const created = await createStaff.mutateAsync({
        ...values,
        roles:
          Array.isArray(values.roles) && values.roles.length > 0
            ? values.roles
            : [staffCreateState.role],
      });
      addStaffId(created.id);
      showToast(autoT('ui_4e679520fcfa', { value0: created.name }));
      setStaffCreateState((current) => ({ ...current, open: false }));
    } catch {
      showToast(autoT('ui_0d661fd89ebb'), { type: 'error' });
    }
  };

  const modals = (
    <>
      {tagCreateOpen ? (
        <TagFormModal
          initial={{ color: '#7aa39a' }}
          onCancel={() => setTagCreateOpen(false)}
          onSubmit={handleTagCreate}
        />
      ) : null}

      {categoryCreateOpen ? (
        <CategoryFormModal
          initial={{ color: '#7aa39a' }}
          onCancel={() => setCategoryCreateOpen(false)}
          onSubmit={handleCategoryCreate}
        />
      ) : null}

      {staffCreateState.open ? (
        <StaffFormModal
          initial={{ roles: [staffCreateState.role] }}
          onCancel={() => setStaffCreateState((current) => ({ ...current, open: false }))}
          onSubmit={handleStaffCreate}
        />
      ) : null}
    </>
  );

  return {
    addActionButtonClassName,
    canCreateOwnCategories,
    canCreateOwnTags,
    canManageStaff,
    modals,
    openCategoryCreate: () => setCategoryCreateOpen(true),
    openTagCreate: () => setTagCreateOpen(true),
    openStaffCreate: (role: StaffRole) => setStaffCreateState({ open: true, role }),
  };
}
