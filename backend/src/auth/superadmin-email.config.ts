export function seedSuperadminEmail() {
  return process.env.SUPERADMIN_EMAIL?.trim().toLowerCase() || 'hubertoink@outlook.com';
}

export function forcedSuperadminEmail() {
  return process.env.SUPERADMIN_EMAIL_FORCE?.toLowerCase() === 'true' ? seedSuperadminEmail() : null;
}
