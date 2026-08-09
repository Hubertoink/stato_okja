import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { CookieNoticeModal, ImprintModal, PrivacyNoticeModal, TermsOfUseModal } from '@/components/LegalModals';
import { fetchPublicSurvey, submitPublicSurvey, type SurveyQuestion } from '@/lib/surveys';
import { useTranslation } from 'react-i18next';
import { autoT } from '@/i18n/auto';
import { useKeyboardOpen } from '@/lib/useKeyboardOpen';

type Answer = string | string[] | number | null;
const browserTokenKey = (token: string) => `stato:survey-device:${token}`;
const submittedKey = (token: string) => `stato:survey-submitted:${token}`;

function browserToken(token: string) {
  const key = browserTokenKey(token);
  const stored = localStorage.getItem(key);
  if (stored) return stored;
  const next = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  localStorage.setItem(key, next);
  return next;
}

function Question({ question, value, onChange }: { question: SurveyQuestion; value: Answer | undefined; onChange: (value: Answer) => void }) {
  const { t } = useTranslation('surveys');
  if (question.type === 'text') return <textarea value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)} rows={5} maxLength={2000} className="mt-5 w-full rounded-2xl border border-slate-300 bg-white p-4 text-lg text-slate-900 shadow-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-200" placeholder={t('public.answerPlaceholder')} />;
  if (question.type === 'scale') {
    const values = Array.from({ length: (question.scaleMax || 5) - (question.scaleMin || 1) + 1 }, (_, index) => (question.scaleMin || 1) + index);
    return <div className="mt-6"><div className="grid grid-cols-5 gap-2">{values.map((entry) => <button key={entry} type="button" onClick={() => onChange(entry)} className={`min-h-14 rounded-2xl border text-lg font-bold transition-colors ${value === entry ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-emerald-50"}`}>{entry}</button>)}</div><div className="mt-2 flex justify-between gap-3 text-sm text-slate-500"><span>{question.scaleMinLabel}</span><span className="text-right">{question.scaleMaxLabel}</span></div></div>;
  }
  const multiple = question.type === 'multiple_choice';
  const selected = Array.isArray(value) ? value : [];
  return <div className="mt-5 space-y-3">{(question.options || []).map((option) => {
    const active = multiple ? selected.includes(option.id) : value === option.id;
    return <button key={option.id} type="button" onClick={() => onChange(multiple ? (active ? selected.filter((entry) => entry !== option.id) : [...selected, option.id]) : option.id)} className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border p-4 text-left text-base font-medium transition-colors ${active ? "border-emerald-700 bg-emerald-50 text-emerald-950" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"}`}><span className={`flex h-6 w-6 shrink-0 items-center justify-center border-2 ${multiple ? "rounded-lg" : "rounded-full"} ${active ? "border-emerald-700 bg-emerald-700" : "border-slate-400 bg-white"}`}>{active ? <CheckCircle2 className="h-4 w-4 text-white" /> : null}</span>{option.label}</button>;
  })}</div>;
}

function PublicBrand({ organizationName }: { organizationName?: string | null }) {
  return <div className="mx-auto mb-4 flex w-full max-w-2xl items-center gap-2 px-1 text-sm text-emerald-950"><img src="/apple-touch-icon.png" className="h-8 w-8 rounded-lg" alt={autoT('ui_3abd120bdece')} /><span className="font-bold">{autoT('ui_3abd120bdece')}</span>{organizationName ? <><span className="text-emerald-700/50">·</span><span className="truncate font-medium">{organizationName}</span></> : null}</div>;
}

function PublicFooter({ onImprint, onPrivacy, onTerms, onCookies }: { onImprint: () => void; onPrivacy: () => void; onTerms: () => void; onCookies: () => void }) {
  const { t } = useTranslation(['surveys', 'common']);
  return <footer className="mx-auto mt-5 max-w-2xl px-2 pb-4 text-center text-xs text-slate-500"><p>{t('public.privacyHint')}</p><nav className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2" aria-label={t('public.legalNav')}><button type="button" className="underline decoration-slate-300 underline-offset-2 hover:text-emerald-800" onClick={onImprint}>{t('common:legal.imprint')}</button><button type="button" className="underline decoration-slate-300 underline-offset-2 hover:text-emerald-800" onClick={onPrivacy}>{t('common:legal.privacy')}</button><button type="button" className="underline decoration-slate-300 underline-offset-2 hover:text-emerald-800" onClick={onTerms}>{t('common:legal.terms')}</button><button type="button" className="underline decoration-slate-300 underline-offset-2 hover:text-emerald-800" onClick={onCookies}>{t('public.browserStorage')}</button></nav></footer>;
}

export default function PublicSurvey() {
  const { t } = useTranslation('surveys');
  const { token = '' } = useParams();
  const [survey, setSurvey] = useState<Awaited<ReturnType<typeof fetchPublicSurvey>> | null>(null);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [legalModal, setLegalModal] = useState<'imprint' | 'privacy' | 'terms' | 'cookies' | null>(null);

  useEffect(() => {
    let active = true;
    setSurvey(null);
    setError('');
    void fetchPublicSurvey(token).then((next) => {
      if (!active) return;
      setSurvey(next);
      if (!next.allowMultiplePerDevice && localStorage.getItem(submittedKey(token)) === 'true') setDone(true);
    }).catch(() => {
      if (active) setError(t('public.unavailableError'));
    });
    return () => { active = false; };
  }, [t, token]);

  const questions = survey?.questions || [];
  const current = questions[index];
  const isLast = index === questions.length - 1;
  const progress = questions.length ? Math.round(((index + 1) / questions.length) * 100) : 0;
  const validateCurrent = () => {
    if (!current?.required) return true;
    const value = answers[current.id];
    return !(value === null || typeof value === 'undefined' || value === '' || (Array.isArray(value) && value.length === 0));
  };
  const next = () => {
    if (!validateCurrent()) { setError(t('public.required')); return; }
    setError('');
    if (!isLast) setIndex((value) => value + 1);
    else void submit();
  };
  const submit = async () => {
    if (!survey) return;
    setSubmitting(true);
    setError('');
    try {
      await submitPublicSurvey(token, answers, survey.allowMultiplePerDevice ? undefined : browserToken(token));
      if (!survey.allowMultiplePerDevice) localStorage.setItem(submittedKey(token), 'true');
      setDone(true);
    } catch (requestError: unknown) {
      const message = (requestError as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message || t('public.submitError'));
    } finally {
      setSubmitting(false);
    }
  };
  const again = () => { setAnswers({}); setIndex(0); setDone(false); setError(''); };
  const keyboardOpen = useKeyboardOpen();
  const legalFooter = keyboardOpen ? null : <PublicFooter onImprint={() => setLegalModal('imprint')} onPrivacy={() => setLegalModal('privacy')} onTerms={() => setLegalModal('terms')} onCookies={() => setLegalModal('cookies')} />;
  const legalModals = <><ImprintModal open={legalModal === 'imprint'} onClose={() => setLegalModal(null)} theme="public" /><PrivacyNoticeModal open={legalModal === 'privacy'} onClose={() => setLegalModal(null)} theme="public" /><TermsOfUseModal open={legalModal === 'terms'} onClose={() => setLegalModal(null)} theme="public" /><CookieNoticeModal open={legalModal === 'cookies'} onClose={() => setLegalModal(null)} theme="public" /></>;

  if (error && !survey) return <><main className="public-survey flex min-h-screen items-center justify-center bg-slate-50 p-5"><section className="max-w-md rounded-3xl bg-white p-8 text-center shadow-xl"><h1 className="text-2xl font-bold text-emerald-900">{t('public.unavailable')}</h1><p className="mt-3 text-slate-600">{error}</p></section></main>{legalModals}</>;
  if (!survey) return <main className="public-survey flex min-h-screen items-center justify-center bg-slate-50"><div className="rounded-2xl bg-white px-5 py-4 text-slate-600 shadow">{t('public.loading')}</div></main>;
  if (done) return <><main className="public-survey min-h-screen bg-gradient-to-b from-emerald-50 to-slate-50 p-5"><div className="mx-auto pt-1"><PublicBrand organizationName={survey.organizationName} /><section className="mx-auto w-full max-w-xl rounded-3xl bg-white p-7 text-center shadow-xl md:p-10"><CheckCircle2 className="mx-auto h-16 w-16 text-emerald-600" /><h1 className="mt-5 text-3xl font-bold text-emerald-950">{t('public.thankYou')}</h1><p className="mt-3 text-lg text-slate-600">{t('public.saved')}</p>{survey.allowMultiplePerDevice ? <button type="button" onClick={again} className="mt-7 min-h-14 rounded-2xl bg-emerald-700 px-6 text-base font-semibold text-white hover:bg-emerald-800">{t('public.again')}</button> : <p className="mt-6 text-sm text-slate-500">{t('public.completed')}</p>}</section>{legalFooter}</div></main>{legalModals}</>;

  return <><main className={`public-survey min-h-screen bg-gradient-to-b from-emerald-50 to-slate-50 px-4 text-slate-900 ${keyboardOpen ? 'py-2' : 'py-6'} md:py-10`}><section className="mx-auto w-full max-w-2xl"><PublicBrand organizationName={survey.organizationName} /><header className="mb-5 rounded-3xl bg-emerald-900 px-6 py-5 text-white shadow-lg"><p className="text-sm font-medium text-emerald-100">{t('public.opinion')}</p><h1 className="mt-1 text-2xl font-bold md:text-3xl">{survey.title}</h1>{survey.introduction ? <p className="mt-3 text-emerald-50">{survey.introduction}</p> : null}</header><div className="mb-4 h-2 overflow-hidden rounded-full bg-emerald-100"><div className="h-full rounded-full bg-emerald-700 transition-all" style={{ width: `${progress}%` }} /></div><p className="mb-3 text-right text-sm text-slate-500">{t('public.progress', { current: index + 1, total: questions.length })}</p><article className="rounded-3xl bg-white p-6 shadow-xl md:p-8"><h2 className="text-xl font-bold leading-snug text-emerald-950 md:text-2xl">{current?.label}</h2>{current?.hint ? <p className="mt-2 text-slate-600">{current.hint}</p> : null}{!current?.required ? <p className="mt-2 text-sm text-slate-500">{t('public.optional')}</p> : null}{current ? <Question question={current} value={answers[current.id]} onChange={(value) => setAnswers((previous) => ({ ...previous, [current.id]: value }))} /> : null}{error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}<footer className={`${keyboardOpen ? 'mt-4 gap-2' : 'mt-8 gap-3'} flex flex-col-reverse sm:flex-row sm:justify-between`}><button type="button" onClick={() => { setError(''); setIndex((value) => Math.max(0, value - 1)); }} disabled={index === 0} className="min-h-14 rounded-2xl border border-slate-300 px-5 font-semibold text-slate-700 disabled:opacity-40"><ChevronLeft className="mr-1 inline h-5 w-5" /> {t('public.back')}</button><button type="button" onClick={next} disabled={submitting} className="min-h-14 rounded-2xl bg-emerald-700 px-6 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">{submitting ? t('public.sending') : isLast ? <><Send className="mr-1 inline h-5 w-5" /> {t('public.submit')}</> : <>{t('public.next')} <ChevronRight className="ml-1 inline h-5 w-5" /></>}</button></footer></article>{legalFooter}</section></main>{legalModals}</>;
}
