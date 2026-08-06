import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, BarChart3, ClipboardList, Copy, Download, Plus, Search, Trash2, Upload, X } from 'lucide-react';
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

function QuestionEditor({ value, index, onChange, onRemove, onMoveUp, onMoveDown, canMoveUp, canMoveDown }: { value: SurveyQuestion; index: number; onChange: (next: SurveyQuestion) => void; onRemove: () => void; onMoveUp: () => void; onMoveDown: () => void; canMoveUp: boolean; canMoveDown: boolean }) {
  const { t } = useTranslation('surveys');
  const setType = (type: SurveyQuestionType) => onChange({ ...question(type, value.label, t), id: value.id, required: value.required });
  const isChoice = value.type === 'single_choice' || value.type === 'multiple_choice';
  return <SurfaceCard padding="sm" className="space-y-3">
    <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-viridian">{t('questionEditor.number', { number: index + 1 })}</span><div className="flex items-center gap-1"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={onMoveUp} disabled={!canMoveUp} aria-label={t('questionEditor.moveUp')} title={t('questionEditor.up')}><ArrowUp className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8" onClick={onMoveDown} disabled={!canMoveDown} aria-label={t('questionEditor.moveDown')} title={t('questionEditor.down')}><ArrowDown className="h-4 w-4" /></Button><Button variant="ghost" size="sm" className="text-red-700 hover:bg-red-50 hover:text-red-700" onClick={onRemove} aria-label={t('questionEditor.remove')}><Trash2 className="h-4 w-4" /> {t('questionEditor.remove')}</Button></div></div>
    <div className="grid gap-3 md:grid-cols-[1fr_11rem]"><div><FieldLabel>{t('questionEditor.question')}</FieldLabel><Input value={value.label} onChange={(event) => onChange({ ...value, label: event.target.value })} placeholder={t('questionEditor.placeholder')} /></div><div><FieldLabel>{t('questionEditor.format')}</FieldLabel><Select value={value.type} onChange={(event) => setType(event.target.value as SurveyQuestionType)}><option value="single_choice">{t('questionEditor.single')}</option><option value="multiple_choice">{t('questionEditor.multiple')}</option><option value="scale">{t('questionEditor.scale')}</option><option value="text">{t('questionEditor.text')}</option></Select></div></div>
    {isChoice ? <div className="space-y-2"><FieldLabel>{t('questionEditor.options')}</FieldLabel>{(value.options || []).map((entry, optionIndex) => <div key={entry.id} className="flex gap-2"><Input value={entry.label} onChange={(event) => onChange({ ...value, options: (value.options || []).map((item, i) => i === optionIndex ? { ...item, label: event.target.value } : item) })} /><Button size="icon" variant="ghost" onClick={() => onChange({ ...value, options: (value.options || []).filter((_, i) => i !== optionIndex) })} aria-label={t('questionEditor.removeOption')}><Trash2 className="h-4 w-4" /></Button></div>)}<Button size="sm" variant="secondary" onClick={() => onChange({ ...value, options: [...(value.options || []), option(t('questionEditor.option', { number: (value.options?.length || 0) + 1 }))] })}>{t('questionEditor.addOption')}</Button></div> : null}
    {value.type === 'scale' ? <div className="grid gap-3 md:grid-cols-2"><div><FieldLabel>{t('questionEditor.leftLabel')}</FieldLabel><Input value={value.scaleMinLabel || ''} onChange={(event) => onChange({ ...value, scaleMinLabel: event.target.value })} /></div><div><FieldLabel>{t('questionEditor.rightLabel')}</FieldLabel><Input value={value.scaleMaxLabel || ''} onChange={(event) => onChange({ ...value, scaleMaxLabel: event.target.value })} /></div></div> : null}
    <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"><input type="checkbox" checked={!!value.required} onChange={(event) => onChange({ ...value, required: event.target.checked })} /> {t('questionEditor.required')}</label>
  </SurfaceCard>;
}

export function SurveyEditor({ open, survey, onClose, initialTemplate, instanceKey = 0 }: { open: boolean; survey?: Survey | null; onClose: () => void; initialTemplate?: Pick<SurveyInput, 'title' | 'introduction' | 'questions'> | null; instanceKey?: number }) {
  const { t } = useTranslation(['surveys', 'common']);
  const initialIdentity = `${survey?.id || 'new'}:${instanceKey}`;
  const [state, setState] = useState<EditorState>(() => toEditor(t, survey || undefined, initialTemplate));
  const [initialId, setInitialId] = useState(initialIdentity);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const { discardDialog, requestDiscard, reset } = useUnsavedChangesGuard(state, { enabled: open });
  useEffect(() => {
    if (initialIdentity === initialId) return;
    const nextState = toEditor(t, survey || undefined, initialTemplate);
    setInitialId(initialIdentity);
    setState(nextState);
    reset(nextState);
  }, [initialId, initialIdentity, initialTemplate, reset, survey, t]);
  const navigate = useNavigate(); const { showToast } = useToast(); const create = useCreateSurvey(); const update = useUpdateSurvey();
  const cohorts = useCohorts({ active: true }).data || []; const projects = useProjects({ archived: false }).data || [];
  const selectedProject = projects.find((project) => project.id === state.projectId);
  const busy = create.isPending || update.isPending;
  const set = <K extends keyof EditorState>(key: K, value: EditorState[K]) => setState((previous) => ({ ...previous, [key]: value }));
  const moveQuestion = (from: number, to: number) => {
    if (to < 0 || to >= state.questions.length) return;
    const questions = [...state.questions];
    const [moved] = questions.splice(from, 1);
    questions.splice(to, 0, moved);
    set('questions', questions);
  };
  const addDemographic = (kind: 'age' | 'gender' | 'origin') => {
    if (kind === 'age') set('questions', [...state.questions, { ...question('single_choice', t('templates.age'), t), demographicKey: 'age_cohort', required: false, options: cohorts.map((cohort) => option(cohort.name)) }]);
    if (kind === 'gender') set('questions', [...state.questions, { ...question('single_choice', t('templates.gender'), t), demographicKey: 'gender', required: false, options: [t('templates.female'), t('templates.male'), t('templates.diverse'), t('templates.preferNot')].map(option) }]);
    if (kind === 'origin') set('questions', [...state.questions, { ...question('single_choice', t('templates.district'), t), demographicKey: 'origin_area', required: false, options: [t('templates.preferNot'), t('templates.outside')].map(option) }]);
  };
  const save = async () => {
    if (!state.title.trim()) { showToast(t('editor.enterTitle'), { type: 'error' }); return; }
    const data: SurveyInput = { title: state.title, introduction: state.introduction || null, projectId: state.projectId || null, expectedParticipants: state.expectedParticipants ? Number(state.expectedParticipants) : null, startsAt: localToIso(state.startsAt), endsAt: localToIso(state.endsAt), allowMultiplePerDevice: state.allowMultiplePerDevice, questions: state.questions };
    try { const saved = survey ? await update.mutateAsync({ id: survey.id, data }) as Survey : await create.mutateAsync(data) as Survey; showToast(survey ? t('editor.saved') : t('editor.created')); reset(state); onClose(); navigate(`/surveys/${saved.id}`); } catch (error: unknown) { showToast((error as { response?: { data?: { message?: string } } })?.response?.data?.message || t('editor.saveError'), { type: 'error' }); }
  };
  const closeEditor = () => requestDiscard(onClose);
  const actions = <EditorActions
    className="-mx-4 -mb-5 mt-5 md:-mx-6"
    secondary={<Button variant="ghost" size="lg" onClick={closeEditor}>{t('common:actions.cancel')}</Button>}
    primary={<Button size="lg" onClick={() => void save()} disabled={busy}>{busy ? t('editor.saving') : t('editor.saveDraft')}</Button>}
  />;
  return <><Modal open={open} onClose={closeEditor} title={survey ? t('editor.edit') : initialTemplate ? t('editor.useTemplate') : t('editor.new')} maxWidth="5xl" variant="form">
    <div className="flex min-h-0 flex-1 flex-col"><div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 md:px-6"><div className="grid gap-4 md:grid-cols-2"><div><FieldLabel>{t('editor.title')}</FieldLabel><Input value={state.title} onChange={(event) => set('title', event.target.value)} placeholder={t('editor.titlePlaceholder')} /></div><div><FieldLabel>{t('editor.project')}</FieldLabel><div className="flex gap-2"><Button className="min-w-0 flex-1 justify-start" variant="secondary" onClick={() => setProjectPickerOpen(true)}>{selectedProject ? <span className="flex min-w-0 items-center gap-2"><span className="h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-gray-100" style={{ backgroundColor: selectedProject.color || colorFromStringHash(selectedProject.title) }}>{selectedProject.imageUrl ? <ProtectedImage src={selectedProject.imageUrl} alt="" className="h-full w-full object-cover" /> : null}</span><span className="truncate">{selectedProject.title}</span></span> : t('editor.general')}</Button>{state.projectId ? <Button size="icon" variant="secondary" onClick={() => set('projectId', '')} aria-label={t('editor.unlinkProject')}><X className="h-4 w-4" /></Button> : null}</div><FieldHint>{t('editor.projectHint')}</FieldHint></div></div>
      <div><FieldLabel>{t('editor.introduction')}</FieldLabel><Textarea rows={3} value={state.introduction} onChange={(event) => set('introduction', event.target.value)} placeholder={t('editor.introductionPlaceholder')} /></div>
      <div className="grid gap-4 md:grid-cols-3"><div><FieldLabel>{t('editor.expected')}</FieldLabel><Input type="number" min="1" value={state.expectedParticipants} onChange={(event) => set('expectedParticipants', event.target.value)} /><FieldHint>{t('editor.expectedHint')}</FieldHint></div><div><FieldLabel>{t('editor.starts')}</FieldLabel><Input type="datetime-local" value={state.startsAt} onChange={(event) => set('startsAt', event.target.value)} /></div><div><FieldLabel>{t('editor.ends')}</FieldLabel><Input type="datetime-local" value={state.endsAt} onChange={(event) => set('endsAt', event.target.value)} /><FieldHint>{t('editor.endHint')}</FieldHint></div></div>
      <label className="flex items-start gap-2 rounded-xl bg-[var(--surface-2)] p-3 text-sm"><input className="mt-1" type="checkbox" checked={state.allowMultiplePerDevice} onChange={(event) => set('allowMultiplePerDevice', event.target.checked)} /><span><span className="font-medium text-[var(--text-primary)]">{t('editor.multiple')}</span><br /><span className="text-[var(--text-secondary)]">{t('editor.multipleHint')}</span></span></label>
      {!survey ? <div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => set('questions', generalTemplate(t))}>{t('editor.wishesTemplate')}</Button><Button size="sm" variant="secondary" onClick={() => set('questions', projectTemplate(t))}>{t('editor.projectTemplate')}</Button><Button size="sm" variant="secondary" onClick={() => set('questions', [])}>{t('editor.emptyTemplate')}</Button></div> : null}
      <div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold text-viridian">{t('editor.questions')}</h4><div className="flex flex-wrap gap-2"><Button size="sm" variant={state.questions.some((entry) => entry.demographicKey === 'age_cohort') ? "primary" : "secondary"} onClick={() => addDemographic('age')}>+ {t('editor.age')}</Button><Button size="sm" variant={state.questions.some((entry) => entry.demographicKey === 'gender') ? "primary" : "secondary"} onClick={() => addDemographic('gender')}>+ {t('editor.gender')}</Button><Button size="sm" variant={state.questions.some((entry) => entry.demographicKey === 'origin_area') ? "primary" : "secondary"} onClick={() => addDemographic('origin')}>+ {t('editor.district')}</Button><Button size="sm" onClick={() => set('questions', [...state.questions, question('single_choice', '', t)])}><Plus className="h-4 w-4" /> {t('editor.question')}</Button></div></div><FieldHint>{t('editor.demographicHint')}</FieldHint>{state.questions.map((entry, index) => <QuestionEditor key={entry.id} value={entry} index={index} onChange={(next) => set('questions', state.questions.map((item, itemIndex) => itemIndex === index ? next : item))} onRemove={() => set('questions', state.questions.filter((_, itemIndex) => itemIndex !== index))} onMoveUp={() => moveQuestion(index, index - 1)} onMoveDown={() => moveQuestion(index, index + 1)} canMoveUp={index > 0} canMoveDown={index < state.questions.length - 1} />)}</div>
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
