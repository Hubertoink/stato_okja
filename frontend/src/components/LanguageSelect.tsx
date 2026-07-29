import { useTranslation } from 'react-i18next';
import { APP_LOCALES, type AppLocale, normalizeAppLocale } from '@/i18n/locales';
import { setPreferredLocale } from '@/i18n';

type LanguageSelectProps = {
  className?: string;
};

export default function LanguageSelect({ className = '' }: LanguageSelectProps) {
  const { t, i18n } = useTranslation('common');
  const locale = normalizeAppLocale(i18n.resolvedLanguage ?? i18n.language);

  return (
    <label className={className}>
      <span className="sr-only">{t('language.label')}</span>
      <select
        aria-label={t('language.label')}
        value={locale}
        onChange={(event) => void setPreferredLocale(event.target.value as AppLocale, { reload: true })}
        className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 shadow-sm focus:border-viridian focus:outline-none focus:ring-2 focus:ring-viridian/20"
      >
        {APP_LOCALES.map((option) => (
          <option key={option} value={option}>{t(`language.options.${option}`)}</option>
        ))}
      </select>
    </label>
  );
}
