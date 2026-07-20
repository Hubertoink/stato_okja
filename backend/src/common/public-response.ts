type UserLike = {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string | null;
  orgId?: string | null;
  theme?: string;
  org?: { id: string; name: string } | null;
};

type StaffLike = {
  id: string;
  email?: string | null;
  name: string;
  role?: string;
  active?: boolean;
  phone?: string | null;
  notes?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  lastLogin?: Date | null;
  orgId?: string | null;
};

type ActivityLike = {
  staff?: StaffLike[] | null;
  createdBy?: StaffLike | null;
  updatedBy?: StaffLike | null;
};

/**
 * API responses must be explicit allowlists. Returning ORM entities directly
 * risks exposing credential hashes when new columns are added later.
 */
export function toPublicUser(user: UserLike) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl ?? null,
    orgId: user.orgId ?? null,
    theme: user.theme ?? 'Default Theme',
    org: user.org ? { id: user.org.id, name: user.org.name } : null,
  };
}

export function toPublicStaff(staff: StaffLike) {
  return {
    id: staff.id,
    email: staff.email ?? null,
    name: staff.name,
    role: staff.role,
    active: staff.active,
    phone: staff.phone ?? null,
    notes: staff.notes ?? null,
    createdAt: staff.createdAt,
    updatedAt: staff.updatedAt,
    lastLogin: staff.lastLogin ?? null,
    orgId: staff.orgId ?? null,
  };
}

export function toPublicActivity<T extends ActivityLike | null | undefined>(activity: T) {
  if (!activity) return activity;

  return {
    ...activity,
    ...(Array.isArray(activity.staff) ? { staff: activity.staff.map(toPublicStaff) } : {}),
    ...(activity.createdBy ? { createdBy: toPublicStaff(activity.createdBy) } : {}),
    ...(activity.updatedBy ? { updatedBy: toPublicStaff(activity.updatedBy) } : {}),
  };
}
