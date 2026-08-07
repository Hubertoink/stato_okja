import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, BarChart3, ClipboardList, Copy, Download, Plus, Save, Search, Trash2, Upload, X } from 'lucide-react';
import Modal from '@/components/Modal';
import ProjectPickerModal from './ProjectPickerModal';
import { SurveyStatusBadge } from '@/components/SurveyStatusBadge';
import { Button } from '@/components/ui/Button';
import { FieldHint, FieldLabel, Input, Select, Textarea } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { EmptyState } from '@/components/ui/EmptyState';
import ProtectedImage from '@/components/ProtectedImage';
import { useToast } from '@/components/Toast';
import { colorFromStringHash } from '@/lib/colors';
import { useCohorts } from '@/lib/taxonomy';
import { useProjects } from '@/lib/projects';
import { createSurveyTemplate, parseSurveyTemplate, surveyQuestionId, type Survey, type SurveyInput, type SurveyQuestion, type SurveyQuestionType, useArchivedSurveys, useArchiveSurvey, useCreateSurvey, useSurveys, useUpdateSurvey } from '@/lib/surveys';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import surveyEmptyIllustration from '../../assets/Illust_Amigos/Umfrage_Keine.svg';
import { EditorActions } from '@/components/ui/EditorFrame';
import { useUnsavedChangesGuard } from '@/lib/useUnsavedChangesGuard';

type EditorState = { title: string; introduction: string; projectId: string; expectedParticipants: string; startsAt: string; endsAt: string; allowMultiplePerDevice: boolean; questions: SurveyQuestion[] };
type QuestionValidation = { label?: string; options?: Record<string, string> };
type SurveyValidation = { title?: string; dates?: string; questions: Record<string, QuestionValidation> };
const isoToLocal = (value?: string | null) => value ? new Date(value).toISOString().slice(0, 16) : '';
const localToIso = (value: string) => value ? new Date(value).toISOString() : null;
const option = (label: string) => ({ id: surveyQuestionId(), label });
const question = (type: SurveyQuestionType, label = '', t?: TFunction): SurveyQuestion => ({ id: surveyQuestionId(), type, label, required: false, options: type === 'single_choice' || type === 'multiple_choice' ? [option(t?.('questionEditor.option', { number: 1 }) || 'Option 1'), option(t?.('questionEditor.option', { number: 2 }) || 'Option 2')] : undefined, scaleMin: type === 'scale' ? 1 : undefined, scaleMax: type === 'scale' ? 5 : undefined, scaleMinLabel: type === 'scale' ? t?.('templates.scaleMin') : undefined, scaleMaxLabel: type === 'scale' ? t?.('templates.scaleMax') : undefined });

function generalTemplate(t: TFunction): SurveyQuestion[] {
  return [
    { ...question('multiple_choice', t('templates.favourite'), t), options: [option(t('templates.sport')), option(t('templates.music')), option(t('templates.gaming')), option(t('templates.friends'))] },
    question('scale', t('templates.comfortable'), t),
    question('multiple_choice', t('templates.moreOften'), t),
    question('text', t('templates.anythingElse'), t),
  ];
}
function projectTemplate(t: TFunction): SurveyQuestion[] {
  return [question('scale', t('templates.fun'), t), question('scale', t('templates.ideas'), t), question('scale', t('templates.return'), t), question('text', t('templates.change'), t)];
}
function toEditor(t: TFunction, survey?: Survey, template?: Pick<SurveyInput, 'title' | 'introduction' | 'questions'> | null): EditorState {
  return { title: survey?.title || template?.title || '', introduction: survey?.introduction || template?.introduction || '', projectId: survey?.projectId || '', expectedParticipants: survey?.expectedParticipants ? String(survey.expectedParticipants) : '', startsAt: isoToLocal(survey?.startsAt), endsAt: isoToLocal(survey?.endsAt), allowMultiplePerDevice: survey?.allowMultiplePerDevice || false, questions: survey?.questions?.length ? survey.questions : template?.questions?.length ? template.questions : generalTemplate(t) };
}

function QuestionEditor({ value, index, errors, isOpen, onChange, onDuplicate, onRemove, onMoveUp, onMoveDown, onToggle, canMoveUp, canMoveDown }: { value: SurveyQuestion; index: number; errors?: QuestionValidation; isOpen: boolean; onChange: (next: SurveyQuestion) => void; onDuplicate: () => void; onRemove: () => void; onMoveUp: () => void; onMoveDown: () => void; onToggle: () => void; canMoveUp: boolean; canMoveDown: boolean }) {
  const { t } = useTranslation('surveys');
  const setType = (type: SurveyQuestionType) => onChange({ ...question(type, value.label, t), id: value.id, required: value.required });
  const isChoice = value.type === 'single_choice' || value.type === 'multiple_choice';
  const fieldId = (name: string) => `survey-question-${value.id}-${name}`;
  const typeLabel = t(`questionEditor.types.${value.type}`);
  return <SurfaceCard padding="sm" className={`${isOpen ? 'survey-question-card-active' : ''} ${errors ? 'border-red-300' : ''}`}>
    <div className="flex items-center gap-2">
      <button type="button" className="min-w-0 flex-1 text-left" onClick={onToggle} aria-expanded={isOpen}>
        <span className="block text-sm font-semibold text-viridian">{t('questionEditor.number', { number: index + 1 })} · {typeLabel}</span>
        <span className="mt-1 block truncate text-sm font-medium text-[var(--text-primary)]">{value.label.trim() || t('questionEditor.untitled')}</span>
        <span className="mt-1 block text-xs text-[var(--text-secondary)]">{value.required ? t('questionEditor.requiredSummary') : t('questionEditor.optionalSummary')}</span>
      </button>
      <div className="flex shrink-0 gap-1"><Button variant="ghost" size="icon" className="min-h-11 min-w-11" onClick={onMoveUp} disabled={!canMoveUp} aria-label={t('questionEditor.moveUp')} title={t('questionEditor.up')}><ArrowUp className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="min-h-11 min-w-11" onClick={onMoveDown} disabled={!canMoveDown} aria-label={t('questionEditor.moveDown')} title={t('questionEditor.down')}><ArrowDown className="h-4 w-4" /></Button></div>
    </div>
    {isOpen ? <div className="mt-4 space-y-3 border-t border-[var(--border-subtle)] pt-4">
      <div className="flex justify-end gap-2"><Button variant="secondary" size="sm" className="min-h-11" onClick={onDuplicate}>{t('questionEditor.duplicate')}</Button><Button variant="ghost" size="sm" className="min-h-11 text-red-700 hover:bg-red-50 hover:text-red-700" onClick={onRemove} aria-label={t('questionEditor.remove')}><Trash2 className="h-4 w-4" /> {t('questionEditor.remove')}</Button></div>
      <div className="grid gap-3 md:grid-cols-[1fr_11rem]"><div><FieldLabel htmlFor={fieldId('label')}>{t('questionEditor.question')}</FieldLabel><Input id={fieldId('label')} value={value.label} onChange={(event) => onChange({ ...value, label: event.target.value })} placeholder={t('questionEditor.placeholder')} aria-invalid={Boolean(errors?.label)} aria-describedby={errors?.label ? fieldId('label-error') : undefined} />{errors?.label ? <p id={fieldId('label-error')} className="mt-1 text-sm text-red-700">{errors.label}</p> : null}</div><div><FieldLabel htmlFor={fieldId('type')}>{t('questionEditor.format')}</FieldLabel><Select id={fieldId('type')} value={value.type} onChange={(event) => setType(event.target.value as SurveyQuestionType)}><option value="single_choice">{t('questionEditor.single')}</option><option value="multiple_choice">{t('questionEditor.multiple')}</option><option value="scale">{t('questionEditor.scale')}</option><option value="text">{t('questionEditor.text')}</option></Select></div></div>
      {isChoice ? <div className="space-y-2"><FieldLabel>{t('questionEditor.options')}</FieldLabel>{(value.options || []).map((entry, optionIndex) => <div key={entry.id} className="flex gap-2"><div className="min-w-0 flex-1"><Input id={fieldId(`option-${entry.id}`)} aria-label={t('questionEditor.option', { number: optionIndex + 1 })} value={entry.label} onChange={(event) => onChange({ ...value, options: (value.options || []).map((item, i) => i === optionIndex ? { ...item, label: event.target.value } : item) })} aria-invalid={Boolean(errors?.options?.[entry.id])} aria-describedby={errors?.options?.[entry.id] ? fieldId(`option-${entry.id}-error`) : undefined} />{errors?.options?.[entry.id] ? <p id={fieldId(`option-${entry.id}-error`)} className="mt-1 text-sm text-red-700">{errors.options[entry.id]}</p> : null}</div><Button size="icon" variant="ghost" className="min-h-11 min-w-11" onClick={() => onChange({ ...value, options: (value.options || []).filter((_, i) => i !== optionIndex) })} aria-label={t('questionEditor.removeOption')}><Trash2 className="h-4 w-4" /></Button></div>)}<Button size="sm" variant="secondary" className="min-h-11" onClick={() => onChange({ ...value, options: [...(value.options || []), option(t('questionEditor.option', { number: (value.options?.length || 0) + 1 }))] })}>{t('questionEditor.addOption')}</Button></div> : null}
      {value.type === 'scale' ? <div className="grid gap-3 md:grid-cols-2"><div><FieldLabel htmlFor={fieldId('scale-min')}>{t('questionEditor.leftLabel')}</FieldLabel><Input id={fieldId('scale-min')} value={value.scaleMinLabel || ''} onChange={(event) => onChange({ ...value, scaleMinLabel: event.target.value })} /></div><div><FieldLabel htmlFor={fieldId('scale-max')}>{t('questionEditor.rightLabel')}</FieldLabel><Input id={fieldId('scale-max')} value={value.scaleMaxLabel || ''} onChange={(event) => onChange({ ...value, scaleMaxLabel: event.target.value })} /></div></div> : null}
      <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--text-secondary)]"><input type="checkbox" checked={!!value.required} onChange={(event) => onChange({ ...value, required: event.target.checked })} /> {t('questionEditor.required')}</label>
    </div> : null}
  </SurfaceCard>;
}

export function SurveyEditor({ open, survey, onClose, initialTemplate, instanceKey = 0 }: { open: boolean; survey?: Survey | null; onClose: () => void; initialTemplate?: Pick<SurveyInput, 'title' | 'introduction' | 'questions'> | null; instanceKey?: number }) {
  const { t } = useTranslation(['surveys', 'common']);
  const initialIdentity = `${survey?.id || 'new'}:${instanceKey}`;
  const [state, setState] = useState<EditorState>(() => toEditor(t, survey || undefined, initialTemplate));
  const [initialId, setInitialId] = useState(initialIdentity);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [step, setStep] = useState<'basics' | 'questions'>('basics');
  const [openQuestionIds, setOpenQuestionIds] = useState<Set<string>>(new Set());
  const [validation, setValidation] = useState<SurveyValidation>({ questions: {} });
  const { discardDialog, requestDiscard, reset } = useUnsavedChangesGuard(state, { enabled: open });
  useEffect(() => {
    if (initialIdentity === initialId) return;
    const nextState = toEditor(t, survey || undefined, initialTemplate);
    setInitialId(initialIdentity);
    setState(nextState);
    setStep('basics');
    setOpenQuestionIds(new Set());
    setValidation({ questions: {} });
    reset(nextState);
  }, [initialId, initialIdentity, initialTemplate, reset, survey, t]);
  const navigate = useNavigate(); const { showToast } = useToast(); const create = useCreateSurvey(); const update = useUpdateSurvey();
  const cohorts = useCohorts({ active: true }).data || []; const projects = useProjects({ archived: false }).data || [];
  const selectedProject = projects.find((project) => project.id === state.projectId);
  const busy = create.isPending || update.isPending;
  const set = <K extends keyof EditorState>(key: K, value: EditorState[K]) => setState((previous) => ({ ...previous, [key]: value }));
  const updateQuestion = (index: number, next: SurveyQuestion) => {
    set('questions', state.questions.map((entry, entryIndex) => entryIndex === index ? next : entry));
    setValidation((previous) => {
      const { [next.id]: _cleared, ...questions } = previous.questions;
      return { ...previous, questions };
    });
  };
  const moveQuestion = (from: number, to: number) => {
    if (to < 0 || to >= state.questions.length) return;
    const questions = [...state.questions];
    const [moved] = questions.splice(from, 1);
    questions.splice(to, 0, moved);
    set('questions', questions);
  };
  const appendQuestion = (next: SurveyQuestion) => {
    set('questions', [...state.questions, next]);
    setOpenQuestionIds((previous) => new Set(previous).add(next.id));
    setStep('questions');
  };
  const duplicateQuestion = (index: number) => {
    const source = state.questions[index];
    const copy = { ...source, id: surveyQuestionId(), options: source.options?.map((entry) => ({ ...entry, id: surveyQuestionId() })) };
    const questions = [...state.questions];
    questions.splice(index + 1, 0, copy);
    set('questions', questions);
    setOpenQuestionIds((previous) => new Set(previous).add(copy.id));
  };
  const replaceQuestions = (questions: SurveyQuestion[]) => {
    set('questions', questions);
    setOpenQuestionIds(questions[0] ? new Set([questions[0].id]) : new Set());
    setValidation((previous) => ({ ...previous, questions: {} }));
    setStep('questions');
  };
  const addDemographic = (kind: 'age' | 'gender' | 'origin') => {
    if (kind === 'age') appendQuestion({ ...question('single_choice', t('templates.age'), t), demographicKey: 'age_cohort', required: false, options: cohorts.map((cohort) => option(cohort.name)) });
    if (kind === 'gender') appendQuestion({ ...question('single_choice', t('templates.gender'), t), demographicKey: 'gender', required: false, options: [t('templates.female'), t('templates.male'), t('templates.diverse'), t('templates.preferNot')].map(option) });
    if (kind === 'origin') appendQuestion({ ...question('single_choice', t('templates.district'), t), demographicKey: 'origin_area', required: false, options: [t('templates.preferNot'), t('templates.outside')].map(option) });
  };
  const validate = (): SurveyValidation => {
    const questions: SurveyValidation['questions'] = {};
    for (const entry of state.questions) {
      const errors: QuestionValidation = {};
      if (!entry.label.trim()) errors.label = t('editor.validationQuestion');
      if (entry.type === 'single_choice' || entry.type === 'multiple_choice') {
        const optionErrors = Object.fromEntries((entry.options || []).filter((item) => !item.label.trim()).map((item) => [item.id, t('editor.validationOption')]));
        if (Object.keys(optionErrors).length) errors.options = optionErrors;
      }
      if (Object.keys(errors).length) questions[entry.id] = errors;
    }
    return {
      title: state.title.trim() ? undefined : t('editor.enterTitle'),
      dates: state.startsAt && state.endsAt && state.startsAt > state.endsAt ? t('editor.validationDates') : undefined,
      questions,
    };
  };
  const save = async () => {
    const nextValidation = validate();
    setValidation(nextValidation);
    const invalidQuestionIds = Object.keys(nextValidation.questions);
    if (nextValidation.title || nextValidation.dates || invalidQuestionIds.length) {
      if (invalidQuestionIds.length) setOpenQuestionIds((previous) => new Set([...previous, ...invalidQuestionIds]));
      setStep(nextValidation.title || nextValidation.dates ? 'basics' : 'questions');
      window.requestAnimationFrame(() => {
        const target = nextValidation.title ? document.getElementById('survey-title') : nextValidation.dates ? document.getElementById('survey-starts-at') : document.getElementById(`survey-question-${invalidQuestionIds[0]}-label`);
        target?.focus();
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      return;
    }
    const data: SurveyInput = { title: state.title, introduction: state.introduction || null, projectId: state.projectId || null, expectedParticipants: state.expectedParticipants ? Number(state.expectedParticipants) : null, startsAt: localToIso(state.startsAt), endsAt: localToIso(state.endsAt), allowMultiplePerDevice: state.allowMultiplePerDevice, questions: state.questions };
    try { const saved = survey ? await update.mutateAsync({ id: survey.id, data }) as Survey : await create.mutateAsync(data) as Survey; showToast(survey ? t('editor.saved') : t('editor.created')); reset(state); onClose(); navigate(`/surveys/${saved.id}`); } catch (error: unknown) { showToast((error as { response?: { data?: { message?: string } } })?.response?.data?.message || t('editor.saveError'), { type: 'error' }); }
  };
  const closeEditor = () => requestDiscard(onClose);
  const actions = <EditorActions
    className="-mx-4 -mb-5 mt-5 md:-mx-6"
    secondary={<Button variant="secondary" size="lg" onClick={step === 'basics' ? closeEditor : () => setStep('basics')}>{step === 'basics' ? t('common:actions.cancel') : t('editor.backToBasics')}</Button>}
    primary={step === 'basics' ? <Button size="lg" onClick={() => setStep('questions')}>{t('editor.nextToQuestions')}</Button> : <Button size="lg" onClick={() => void save()} disabled={busy}>{busy ? t('editor.saving') : t('editor.saveDraft')}</Button>}
  />;
  const headerActions = <Button size="sm" className="min-h-11" onClick={() => void save()} disabled={busy} aria-label={t('editor.saveDraft')}><Save className="h-4 w-4" /><span className="hidden sm:inline">{busy ? t('editor.saving') : t('editor.saveDraft')}</span></Button>;
  return <><Modal open={open} onClose={closeEditor} title={survey ? t('editor.edit') : initialTemplate ? t('editor.useTemplate') : t('editor.new')} maxWidth="5xl" variant="form" headerActions={headerActions}>
    <div className="flex min-h-0 flex-1 flex-col"><div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 md:px-6">
      <div className="grid grid-cols-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-1" role="tablist" aria-label={t('editor.steps')}>
        <Button size="sm" className="min-h-11" variant={step === 'basics' ? 'primary' : 'ghost'} onClick={() => setStep('basics')} role="tab" aria-selected={step === 'basics'}>{t('editor.stepBasics')}</Button>
        <Button size="sm" className="min-h-11" variant={step === 'questions' ? 'primary' : 'ghost'} onClick={() => setStep('questions')} role="tab" aria-selected={step === 'questions'}>{t('editor.stepQuestions')}</Button>
      </div>
      {step === 'basics' ? <>
        <div className="grid gap-4 md:grid-cols-2"><div><FieldLabel htmlFor="survey-title">{t('editor.title')}</FieldLabel><Input id="survey-title" value={state.title} onChange={(event) => { set('title', event.target.value); setValidation((previous) => ({ ...previous, title: undefined })); }} placeholder={t('editor.titlePlaceholder')} aria-invalid={Boolean(validation.title)} aria-describedby={validation.title ? 'survey-title-error' : undefined} />{validation.title ? <p id="survey-title-error" className="mt-1 text-sm text-red-700">{validation.title}</p> : null}</div><div><FieldLabel id="survey-project-label">{t('editor.project')}</FieldLabel><div className="flex gap-2"><Button className="min-h-11 min-w-0 flex-1 justify-start" variant="secondary" onClick={() => setProjectPickerOpen(true)} aria-labelledby="survey-project-label">{selectedProject ? <span className="flex min-w-0 items-center gap-2"><span className="h-8 w-8 shrink-0 overflow-hidden rounded-lg" style={{ backgroundColor: selectedProject.color || colorFromStringHash(selectedProject.title) }}>{selectedProject.imageUrl ? <ProtectedImage src={selectedProject.imageUrl} alt="" className="h-full w-full object-cover" /> : null}</span><span className="truncate">{selectedProject.title}</span></span> : t('editor.general')}</Button>{state.projectId ? <Button size="icon" variant="secondary" className="min-h-11 min-w-11" onClick={() => set('projectId', '')} aria-label={t('editor.unlinkProject')}><X className="h-4 w-4" /></Button> : null}</div><FieldHint>{t('editor.projectHint')}</FieldHint></div></div>
        <div><FieldLabel htmlFor="survey-introduction">{t('editor.introduction')}</FieldLabel><Textarea id="survey-introduction" rows={3} value={state.introduction} onChange={(event) => set('introduction', event.target.value)} placeholder={t('editor.introductionPlaceholder')} /></div>
        <div className="grid gap-4 md:grid-cols-3"><div><FieldLabel htmlFor="survey-expected-participants">{t('editor.expected')}</FieldLabel><Input id="survey-expected-participants" type="number" min="1" value={state.expectedParticipants} onChange={(event) => set('expectedParticipants', event.target.value)} /><FieldHint>{t('editor.expectedHint')}</FieldHint></div><div><FieldLabel htmlFor="survey-starts-at">{t('editor.starts')}</FieldLabel><Input id="survey-starts-at" type="datetime-local" value={state.startsAt} onChange={(event) => { set('startsAt', event.target.value); setValidation((previous) => ({ ...previous, dates: undefined })); }} /></div><div><FieldLabel htmlFor="survey-ends-at">{t('editor.ends')}</FieldLabel><Input id="survey-ends-at" type="datetime-local" value={state.endsAt} onChange={(event) => { set('endsAt', event.target.value); setValidation((previous) => ({ ...previous, dates: undefined })); }} aria-invalid={Boolean(validation.dates)} aria-describedby={validation.dates ? 'survey-dates-error' : undefined} /><FieldHint>{t('editor.endHint')}</FieldHint></div></div>
        {validation.dates ? <p id="survey-dates-error" className="text-sm text-red-700">{validation.dates}</p> : null}
        <label className="flex items-start gap-2 rounded-xl bg-[var(--surface-2)] p-3 text-sm"><input className="mt-1" type="checkbox" checked={state.allowMultiplePerDevice} onChange={(event) => set('allowMultiplePerDevice', event.target.checked)} /><span><span className="font-medium text-[var(--text-primary)]">{t('editor.multiple')}</span><br /><span className="text-[var(--text-secondary)]">{t('editor.multipleHint')}</span></span></label>
        {!survey ? <div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" className="min-h-11" onClick={() => replaceQuestions(generalTemplate(t))}>{t('editor.wishesTemplate')}</Button><Button size="sm" variant="secondary" className="min-h-11" onClick={() => replaceQuestions(projectTemplate(t))}>{t('editor.projectTemplate')}</Button><Button size="sm" variant="secondary" className="min-h-11" onClick={() => replaceQuestions([])}>{t('editor.emptyTemplate')}</Button></div> : null}
      </> : <>
        <div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold text-viridian">{t('editor.questions')}</h4><div className="flex flex-wrap gap-2"><Button size="sm" className="min-h-11" variant={state.questions.some((entry) => entry.demographicKey === 'age_cohort') ? 'primary' : 'secondary'} onClick={() => addDemographic('age')}>+ {t('editor.age')}</Button><Button size="sm" className="min-h-11" variant={state.questions.some((entry) => entry.demographicKey === 'gender') ? 'primary' : 'secondary'} onClick={() => addDemographic('gender')}>+ {t('editor.gender')}</Button><Button size="sm" className="min-h-11" variant={state.questions.some((entry) => entry.demographicKey === 'origin_area') ? 'primary' : 'secondary'} onClick={() => addDemographic('origin')}>+ {t('editor.district')}</Button><Button size="sm" className="min-h-11" onClick={() => appendQuestion(question('single_choice', '', t))}><Plus className="h-4 w-4" /> {t('editor.question')}</Button></div></div><FieldHint>{t('editor.demographicHint')}</FieldHint>{state.questions.map((entry, index) => <QuestionEditor key={entry.id} value={entry} index={index} errors={validation.questions[entry.id]} isOpen={openQuestionIds.has(entry.id)} onToggle={() => setOpenQuestionIds((previous) => { const next = new Set(previous); next.has(entry.id) ? next.delete(entry.id) : next.add(entry.id); return next; })} onChange={(next) => updateQuestion(index, next)} onDuplicate={() => duplicateQuestion(index)} onRemove={() => set('questions', state.questions.filter((_, itemIndex) => itemIndex !== index))} onMoveUp={() => moveQuestion(index, index - 1)} onMoveDown={() => moveQuestion(index, index + 1)} canMoveUp={index > 0} canMoveDown={index < state.questions.length - 1} />)}</div>
        <details className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4"><summary className="cursor-pointer font-semibold text-viridian">{t('editor.preview')}</summary><ol className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">{state.questions.map((entry, index) => <li key={entry.id}><span className="font-medium text-[var(--text-primary)]">{index + 1}. {entry.label || t('questionEditor.untitled')}</span> · {t(`questionEditor.types.${entry.type}`)}{entry.required ? ` · ${t('questionEditor.requiredSummary')}` : ''}</li>)}</ol></details>
      </>}
      {actions}
    </div></div>
  </Modal>{projectPickerOpen ? <ProjectPickerModal onClose={() => setProjectPickerOpen(false)} onPick={(project) => { set('projectId', project.id); setProjectPickerOpen(false); }} /> : null}{discardDialog}</>;
}

export default function Surveys() {
  const { t } = useTranslation('surveys');
  const navigate = useNavigate(); const { showToast } = useToast(); const [search, setSearch] = useState(''); const [archived, setArchived] = useState(false); const [editorOpen, setEditorOpen] = useState(false); const [initialTemplate, setInitialTemplate] = useState<Pick<SurveyInput, 'title' | 'introduction' | 'questions'> | null>(null); const [editorInstance, setEditorInstance] = useState(0); const fileInput = useRef<HTMLInputElement>(null);
  const surveysQuery = useSurveys({ search, archived }); const hasArchived = useArchivedSurveys().data; const archive = useArchiveSurvey();
  const surveys = useMemo(() => surveysQuery.data || [], [surveysQuery.data]);
  const copy = async (survey: Survey) => { const url = `${window.location.origin}/survey/${survey.publicToken}`; try { await navigator.clipboard.writeText(url); showToast(t('linkCopied')); } catch { showToast(t('linkCopyError'), { type: 'error' }); } };
  const exportTemplate = (survey: Survey) => { const blob = new Blob([JSON.stringify(createSurveyTemplate(survey), null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${survey.title.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'survey'}.stato-survey.json`; anchor.click(); URL.revokeObjectURL(url); showToast(t('templateDownloaded')); };
  const openEditor = (template: Pick<SurveyInput, 'title' | 'introduction' | 'questions'> | null = null) => { setInitialTemplate(template); setEditorInstance((current) => current + 1); setEditorOpen(true); };
  const importTemplate = async (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; try { openEditor(parseSurveyTemplate(await file.text())); showToast(t('templateLoaded')); } catch (error: unknown) { showToast(error instanceof Error ? error.message : t('templateReadError'), { type: 'error' }); } };
  return <div className="space-y-5"><PageHeader title={t('title')} actions={<div className="flex flex-wrap justify-end gap-2"><input ref={fileInput} className="hidden" type="file" accept="application/json,.json" onChange={(event) => void importTemplate(event)} /><Button variant="secondary" onClick={() => fileInput.current?.click()}><Upload className="h-4 w-4" /> {t('importTemplate')}</Button><Button onClick={() => openEditor()}><Plus className="h-4 w-4" /> {t('new')}</Button></div>} />
    <div className="flex flex-wrap items-center gap-3"><div className="relative min-w-0 flex-1 md:w-80 md:flex-none"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input className="w-full rounded-xl border border-gray-300 py-2 pl-9 pr-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('search')} /></div>{hasArchived ? <Button variant={archived ? "primary" : "secondary"} onClick={() => setArchived(!archived)}><Archive className="h-4 w-4" /> {archived ? t('showArchive') : t('archive')}</Button> : null}</div>
    {surveysQuery.isLoading ? <p className="text-sm text-[var(--text-secondary)]">{t('loading')}</p> : null}
    {!surveysQuery.isLoading && surveys.length === 0 ? <EmptyState illustration={surveyEmptyIllustration} title={archived ? t('emptyArchived') : t('empty')} description={t('emptyDescription')} action={!archived ? <Button onClick={() => openEditor()}><Plus className="h-4 w-4" /> {t('new')}</Button> : undefined} /> : <div className="space-y-4">{surveys.map((survey) => <SurfaceCard key={survey.id} className="cursor-pointer transition-colors hover:bg-[var(--surface-2)]" onClick={() => navigate(`/surveys/${survey.id}`)}><div className="flex flex-col gap-3 md:flex-row md:items-center"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--interactive-soft)] text-viridian"><ClipboardList /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold text-[var(--text-primary)]">{survey.title}</h2><SurveyStatusBadge status={survey.status} /></div><p className="mt-1 text-sm text-[var(--text-secondary)]">{t('questions', { count: survey.questions.length })} · {t('answers', { count: survey.responsesCount })} {survey.roundsCount && survey.roundsCount > 1 ? `· ${t('rounds', { count: survey.roundsCount })}` : ''} · {survey.projectId ? t('projectSurvey') : t('generalSurvey')}</p></div><div className="flex gap-2" onClick={(event) => event.stopPropagation()}><span className="tooltip-wrapper"><Button size="icon" variant="secondary" aria-label={t('exportTemplate')} title={t('exportTemplate')} onClick={() => exportTemplate(survey)}><Download className="h-4 w-4" /></Button><span className="tooltip-bubble">{t('exportTemplate')}</span></span><span className="tooltip-wrapper"><Button size="icon" variant="secondary" aria-label={t('copyLink')} title={t('copyLink')} onClick={() => void copy(survey)}><Copy className="h-4 w-4" /></Button><span className="tooltip-bubble">{t('copyLink')}</span></span><span className="tooltip-wrapper"><Button size="icon" variant="secondary" aria-label={t('openResults')} title={t('openResults')} onClick={() => navigate(`/surveys/${survey.id}`)}><BarChart3 className="h-4 w-4" /></Button><span className="tooltip-bubble">{t('openResults')}</span></span><span className="tooltip-wrapper"><Button size="icon" variant="secondary" disabled={survey.status === 'active'} aria-label={survey.archived ? t('restore') : t('archiveAction')} title={survey.archived ? t('restore') : t('archiveAction')} onClick={() => archive.mutate({ id: survey.id, archived: !survey.archived }, { onSuccess: () => showToast(survey.archived ? t('restored') : t('archived')) })}>{survey.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}</Button><span className="tooltip-bubble">{survey.archived ? t('restore') : t('archiveAction')}</span></span></div></div></SurfaceCard>)}</div>}
    <SurveyEditor open={editorOpen} initialTemplate={initialTemplate} instanceKey={editorInstance} onClose={() => setEditorOpen(false)} />
  </div>;
}
