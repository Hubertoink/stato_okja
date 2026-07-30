import { Globe2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Modal from '@/components/Modal';
import { setPreferredLocale } from '@/i18n';
import { APP_LOCALES, type AppLocale, normalizeAppLocale } from '@/i18n/locales';

type LanguagePickerModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function LanguagePickerModal({ open, onClose }: LanguagePickerModalProps) {
  const { t, i18n } = useTranslation('common');
  const currentLocale = normalizeAppLocale(i18n.resolvedLanguage ?? i18n.language);

  return (
    <Modal open={open} onClose={onClose} title={t('language.modalTitle')} maxWidth="sm" variant="information">
      <div className="space-y-2 py-1">
        {APP_LOCALES.map((locale) => {
          const isActive = locale === currentLocale;
          return (
            <button
              key={locale}
              type="button"
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                isActive
                  ? 'border-viridian bg-viridian/10 text-viridian'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
              onClick={() => {
                if (isActive) {
                  onClose();
                  return;
                }
                void setPreferredLocale(locale as AppLocale, { reload: true });
              }}
            >
              <span>{t(`language.options.${locale}`)}</span>
              {isActive ? <Globe2 className="h-4 w-4" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
