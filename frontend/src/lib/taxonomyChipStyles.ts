export function getSelectableTaxonomyChipStyle(active: boolean | undefined, color?: string | null) {
  const accent = color || '#7aa39a';

  if (active) {
    return {
      backgroundColor: accent,
      color: '#fff',
      borderColor: accent,
    };
  }

  return {
    backgroundColor: 'var(--surface-1)',
    color: 'var(--text-primary)',
    borderColor: accent,
  };
}