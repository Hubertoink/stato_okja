import i18n from '.';

export function autoT(key: string, values?: Record<string, unknown>): string {
  return i18n.t(key, { ns: 'auto', defaultValue: key, ...values });
}
