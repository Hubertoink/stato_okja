import { api } from './api';
import type { Survey, SurveyAnalytics, SurveyQuestion, SurveyResponse } from './surveys';
import { getCurrentIntlLocale } from '@/i18n/formatters';

export type SurveyExportRound = {
  survey: Survey;
  analytics: SurveyAnalytics;
  responses: SurveyResponse[];
  rawResponsesAvailable: boolean;
};

export type SurveyExportLabels = {
  overview: string;
  round: string;
  rounds: string;
  responses: string;
  submittedAt: string;
  question: string;
  type: string;
  answered: string;
  mean: string;
  median: string;
  answer: string;
  textAnswer: string;
  createdAt: string;
  expectedParticipants: string;
  responseRate: string;
};

export function surveyAnswerLabel(
  question: SurveyQuestion | undefined,
  value: string | string[] | number | null | undefined,
) {
  if (value === null || typeof value === 'undefined' || value === '') return '–';
  const label = (entry: string | number) =>
    question?.options?.find((option) => option.id === String(entry))?.label || String(entry);
  return Array.isArray(value) ? value.map(label).join(', ') : label(value);
}

function slug(title: string) {
  return (
    title
      .toLocaleLowerCase(getCurrentIntlLocale())
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9äöüß_-]+/gi, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'umfrage'
  );
}

export async function fetchSurveyExportRounds(survey: Survey) {
  const rounds = (await api.get(`/surveys/${survey.id}/rounds`)).data as Survey[];
  return Promise.all(
    rounds.map(async (round) => {
      const [analyticsResult, responsesResult] = await Promise.all([
        api.get(`/surveys/${round.id}/analytics`),
        api.get(`/surveys/${round.id}/responses`),
      ]);
      const responsesData = responsesResult.data as {
        rawResponsesAvailable: boolean;
        responses: SurveyResponse[];
      };
      return {
        survey: round,
        analytics: analyticsResult.data as SurveyAnalytics,
        responses: responsesData.responses,
        rawResponsesAvailable: responsesData.rawResponsesAvailable,
      } satisfies SurveyExportRound;
    }),
  );
}

function questionTypeLabel(type: SurveyQuestion['type']) {
  if (type === 'single_choice') return 'Auswahl';
  if (type === 'multiple_choice') return 'Mehrfachauswahl';
  if (type === 'scale') return 'Bewertung';
  return 'Freitext';
}

function roundLabel(round: SurveyExportRound, labels: SurveyExportLabels) {
  return `${labels.round} ${round.survey.roundNumber || 1}`;
}

function safeSheetName(value: string, used: Set<string>) {
  const base = value.replace(/[\\/?*:[\]]/g, '-').slice(0, 31) || 'Umfrage';
  let name = base;
  let suffix = 2;
  while (used.has(name)) {
    const suffixText = ` ${suffix++}`;
    name = `${base.slice(0, 31 - suffixText.length)}${suffixText}`;
  }
  used.add(name);
  return name;
}

export async function exportSurveyRoundsToXlsx(
  survey: Survey,
  rounds: SurveyExportRound[],
  labels: SurveyExportLabels,
) {
  const xlsx = await import('xlsx-js-style');
  const { utils, writeFile } = xlsx as unknown as typeof import('xlsx-js-style');
  const workbook = utils.book_new();
  const usedSheets = new Set<string>();
  const overview = [
    [labels.overview, survey.title],
    [labels.round, rounds.length],
    [labels.createdAt, new Date().toLocaleString(getCurrentIntlLocale())],
    [],
    [labels.round, labels.responses, labels.expectedParticipants, labels.responseRate],
    ...rounds.map((round) => [
      roundLabel(round, labels),
      round.analytics.responsesCount,
      round.analytics.expectedParticipants ?? '–',
      round.analytics.responseRate === null || typeof round.analytics.responseRate === 'undefined'
        ? '–'
        : `${round.analytics.responseRate} %`,
    ]),
  ];
  const overviewSheet = utils.aoa_to_sheet(overview);
  overviewSheet['!cols'] = [{ wch: 28 }, { wch: 44 }, { wch: 24 }, { wch: 20 }];
  utils.book_append_sheet(workbook, overviewSheet, safeSheetName(labels.overview, usedSheets));

  for (const round of rounds) {
    const byQuestion = new Map(round.survey.questions.map((question) => [question.id, question]));
    const results: Array<Array<string | number>> = [
      [labels.question, labels.type, labels.answered, labels.mean, labels.median, labels.answer],
    ];
    round.analytics.questions.forEach((result) => {
      const question = byQuestion.get(result.id);
      if (result.type === 'text') {
        (result.texts || []).forEach((text) =>
          results.push([result.label, questionTypeLabel(result.type), result.answeredCount, '', '', text]),
        );
        if (!result.texts?.length) results.push([result.label, questionTypeLabel(result.type), 0, '', '', '–']);
        return;
      }
      Object.entries(result.counts || {}).forEach(([value, count]) => {
        const answer =
          question?.type === 'scale'
            ? `${value}${value === String(question.scaleMin ?? 1) ? ` – ${question.scaleMinLabel || ''}` : ''}${value === String(question.scaleMax ?? 5) ? ` – ${question.scaleMaxLabel || ''}` : ''}`.trim()
            : question?.options?.find((entry) => entry.id === value)?.label || value;
        results.push([
          result.label,
          questionTypeLabel(result.type),
          result.answeredCount,
          result.mean ?? '',
          result.median ?? '',
          `${answer} (${count})`,
        ]);
      });
    });
    const resultSheet = utils.aoa_to_sheet(results);
    resultSheet['!cols'] = [{ wch: 44 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 52 }];
    utils.book_append_sheet(workbook, resultSheet, safeSheetName(roundLabel(round, labels), usedSheets));

    if (round.rawResponsesAvailable) {
      const responseRows = [
        ['#', labels.submittedAt, ...round.survey.questions.map((question) => question.label || question.id)],
        ...round.responses.map((response) => [
          response.number,
          new Date(response.submittedAt).toLocaleString(getCurrentIntlLocale()),
          ...round.survey.questions.map((question) =>
            surveyAnswerLabel(question, response.answers[question.id]),
          ),
        ]),
      ];
      const responseSheet = utils.aoa_to_sheet(responseRows);
      responseSheet['!cols'] = [
        { wch: 8 },
        { wch: 22 },
        ...round.survey.questions.map(() => ({ wch: 28 })),
      ];
      utils.book_append_sheet(
        workbook,
        responseSheet,
        safeSheetName(`${roundLabel(round, labels)} ${labels.responses}`, usedSheets),
      );
    }
  }

  writeFile(workbook, `${slug(survey.title)}-daten.xlsx`);
}

export async function exportSurveyRoundsToPdf(
  survey: Survey,
  rounds: SurveyExportRound[],
  labels: SurveyExportLabels,
) {
  const { default: JsPDF } = await import('jspdf');
  const pdf = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;
  let firstPage = true;
  const ensureSpace = (height: number) => {
    if (y + height <= pageHeight - margin) return;
    pdf.addPage();
    y = margin;
  };
  const writeLines = (lines: string[], fontSize = 10, gap = 5) => {
    pdf.setFontSize(fontSize);
    lines.forEach((line) => {
      const wrapped = pdf.splitTextToSize(line, contentWidth) as string[];
      ensureSpace(wrapped.length * gap + 1);
      pdf.text(wrapped, margin, y);
      y += wrapped.length * gap;
    });
  };
  pdf.setTextColor(31, 41, 55);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text(survey.title, margin, y);
  y += 9;
  pdf.setFont('helvetica', 'normal');
  writeLines([`${rounds.length} ${rounds.length === 1 ? labels.round : labels.rounds}`, `${labels.createdAt}: ${new Date().toLocaleString(getCurrentIntlLocale())}`], 10, 5);

  rounds.forEach((round, roundIndex) => {
    if (!firstPage || y > pageHeight - 55) {
      pdf.addPage();
      y = margin;
    }
    firstPage = false;
    pdf.setTextColor(15, 118, 110);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.text(roundLabel(round, labels), margin, y);
    y += 7;
    pdf.setTextColor(31, 41, 55);
    pdf.setFont('helvetica', 'normal');
    writeLines([
      `${labels.responses}: ${round.analytics.responsesCount}`,
      `${labels.expectedParticipants}: ${round.analytics.expectedParticipants ?? '–'}`,
      `${labels.responseRate}: ${round.analytics.responseRate ?? '–'}${round.analytics.responseRate === null || typeof round.analytics.responseRate === 'undefined' ? '' : ' %'}`,
    ], 10, 5);
    y += 2;
    round.analytics.questions.forEach((result, questionIndex) => {
      ensureSpace(18);
      pdf.setTextColor(15, 118, 110);
      pdf.setFont('helvetica', 'bold');
      writeLines([`${questionIndex + 1}. ${result.label}`], 11, 5);
      pdf.setTextColor(31, 41, 55);
      pdf.setFont('helvetica', 'normal');
      writeLines([
        `${labels.answered}: ${result.answeredCount}`,
        result.mean === null || typeof result.mean === 'undefined' ? '' : `${labels.mean}: ${result.mean}`,
        result.median === null || typeof result.median === 'undefined' ? '' : `${labels.median}: ${result.median}`,
        ...(result.type === 'text' ? (result.texts || []).slice(0, 12).map((text) => `${labels.textAnswer}: ${text}`) : Object.entries(result.counts || {}).map(([value, count]) => `${value}: ${count}`)),
      ].filter(Boolean), 9, 4.5);
      y += 2;
    });
    if (roundIndex < rounds.length - 1) y += 3;
  });
  pdf.save(`${slug(survey.title)}-daten.pdf`);
}
