import Modal from '@/components/Modal';
import LegalDocumentContent from '@/components/LegalDocumentContent';
import { type LegalDocumentKey, useLegalContent } from '@/lib/legalContent';
import { useTranslation } from 'react-i18next';

function LegalDocumentModal({
  documentKey,
  open,
  onClose,
}: {
  documentKey: LegalDocumentKey;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('common');
  const { data, isError, isLoading } = useLegalContent();
  const document = data?.documents[documentKey];
  const fallbackTitles: Record<LegalDocumentKey, string> = {
    imprint: t('legal.imprint'),
    privacy: t('legalDocuments.privacyTitle'),
    terms: t('legal.terms'),
  };

  return (
    <Modal open={open} onClose={onClose} title={document?.title || fallbackTitles[documentKey]} maxWidth="lg" variant="information">
      {isLoading ? <p className="py-4 text-sm text-gray-600">{t('legalDocuments.loading')}</p> : null}
      {isError ? <p className="py-4 text-sm text-red-700">{t('legalDocuments.loadError')}</p> : null}
      {document ? <LegalDocumentContent content={document.content} /> : null}
      {documentKey === 'terms' && data?.termsVersion ? (
        <p className="mt-5 text-xs text-gray-500">{t('legalDocuments.version', { version: data.termsVersion })}</p>
      ) : null}
    </Modal>
  );
}

export function ImprintModal(props: { open: boolean; onClose: () => void }) {
  return <LegalDocumentModal {...props} documentKey="imprint" />;
}

export function PrivacyNoticeModal(props: { open: boolean; onClose: () => void }) {
  return <LegalDocumentModal {...props} documentKey="privacy" />;
}

export function TermsOfUseModal(props: { open: boolean; onClose: () => void }) {
  return <LegalDocumentModal {...props} documentKey="terms" />;
}

export function CookieNoticeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation('common');
  return (
    <Modal open={open} onClose={onClose} title={t('legalDocuments.cookieTitle')} maxWidth="lg" variant="information">
      <div className="space-y-5 text-sm text-gray-700">
        <section className="space-y-2">
          <h3 className="text-base font-semibold text-gray-900">{t('legalDocuments.summaryTitle')}</h3>
          <p>{t('legalDocuments.summary')}</p>
        </section>
        <section className="space-y-2">
          <h3 className="text-base font-semibold text-gray-900">{t('legalDocuments.sessionTitle')}</h3>
          <p>{t('legalDocuments.sessionIntro')}</p>
          <ul className="list-disc space-y-1 pl-5 text-gray-600">
            <li>{t('legalDocuments.sessionAuth')}</li>
            <li>{t('legalDocuments.sessionActivity')}</li>
            <li>{t('legalDocuments.sessionCache')}</li>
          </ul>
        </section>
        <section className="space-y-2">
          <h3 className="text-base font-semibold text-gray-900">{t('legalDocuments.localTitle')}</h3>
          <p>{t('legalDocuments.localIntro')}</p>
          <ul className="list-disc space-y-1 pl-5 text-gray-600">
            <li>{t('legalDocuments.localOrg')}</li>
            <li>{t('legalDocuments.localFilters')}</li>
            <li>{t('legalDocuments.localComfort')}</li>
            <li>{t('legalDocuments.localSurvey')}</li>
          </ul>
        </section>
        <section className="space-y-2">
          <h3 className="text-base font-semibold text-gray-900">{t('legalDocuments.cookiesTitle')}</h3>
          <p>{t('legalDocuments.cookiesText')}</p>
        </section>
      </div>
    </Modal>
  );
}
