import {
  AnnualTarget,
  formatTargetValue,
  targetDifference,
  targetMetrics,
  targetRequirement,
  targetScopeLabel,
  targetStatuses,
} from '@/lib/annualTargets';

export async function exportAnnualTargets(
  targets: AnnualTarget[],
  year: number,
  organization: string,
  format: 'xlsx' | 'pdf',
) {
  const headers = [
    'Ziel',
    'Bezug',
    'Kennzahl',
    'Vorgabe',
    'Istwert',
    'Abstand',
    'Status',
    'Stichtag',
    'Aktueller Wert',
    'Daten seit Abschluss geändert',
    'Begründung / Verantwortung',
    'Fachliche Einordnung',
  ];
  const rows = targets.map((target) => [
    target.title,
    targetScopeLabel(target),
    targetMetrics[target.metric],
    targetRequirement(target),
    formatTargetValue(target.result.value, target.metric),
    targetDifference(target),
    targetStatuses[target.status],
    target.result.asOf,
    formatTargetValue(target.current.value, target.metric),
    target.dataChanged ? 'Ja' : 'Nein',
    target.description,
    target.review,
  ]);
  const note =
    'Nur durchgeführte Aktivitäten bis zum Stichtag. Besuche zählen Teilnahmen; Prozentanteile beziehen sich auf Besuche mit Geschlechtszuordnung. Abschlusswerte bleiben gespeichert; aktuelle Werte können abweichen.';
  if (format === 'xlsx') {
    const XLSX = await import('xlsx-js-style');
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      [`Jahresziele ${year}`, organization],
      [],
      headers,
      ...rows,
    ]);
    sheet['!cols'] = headers.map((_, index) => ({ wch: [0, 1, 10, 11].includes(index) ? 42 : 24 }));
    sheet['!autofilter'] = { ref: `A3:L${rows.length + 3}` };
    for (let row = 2; row < rows.length + 3; row++)
      for (let column = 0; column < headers.length; column++) {
        const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
        if (cell)
          cell.s = {
            alignment: { vertical: 'top', wrapText: true },
            ...(row === 2
              ? {
                  font: { bold: true, color: { rgb: 'FFFFFF' } },
                  fill: { fgColor: { rgb: '40826D' } },
                }
              : {}),
          };
      }
    XLSX.utils.book_append_sheet(workbook, sheet, 'Jahresziele');
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['Berechnungsgrundlage'],
        [note],
        ['Exportiert am', new Date().toLocaleString('de-DE')],
      ]),
      'Hinweise',
    );
    XLSX.writeFile(workbook, `Stato-Jahresziele-${year}.xlsx`);
    return;
  }
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF();
  let y = 20;
  const paragraph = (text: string, bold = false) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    const lines: string[] = pdf.splitTextToSize(text, 174);
    for (const line of lines) {
      if (y > 275) {
        pdf.addPage();
        y = 20;
      }
      pdf.text(line, 18, y);
      y += 5;
    }
    y += 3;
  };
  pdf.setFontSize(15);
  paragraph(`Jahresziele ${year}`, true);
  pdf.setFontSize(10);
  paragraph(organization);
  paragraph(note);
  for (const target of targets) {
    if (y > 225) {
      pdf.addPage();
      y = 20;
    }
    paragraph(target.title, true);
    paragraph(
      `${targetScopeLabel(target)} | ${targetMetrics[target.metric]} | ${targetStatuses[target.status]}`,
    );
    paragraph(
      `Vorgabe: ${targetRequirement(target)} | Ist: ${formatTargetValue(target.result.value, target.metric)} | ${targetDifference(target)}`,
    );
    paragraph(
      `Stichtag: ${target.result.asOf}${target.dataChanged ? ` | Daten seit Abschluss geändert. Aktuell: ${formatTargetValue(target.current.value, target.metric)}` : ''}`,
    );
    if (target.description) paragraph(`Begründung / Verantwortung: ${target.description}`);
    if (target.review) paragraph(`Jahresabschluss: ${target.review}`);
    y += 5;
  }
  for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
    pdf.setPage(page);
    pdf.setFontSize(9);
    pdf.text(`${page} / ${pdf.getNumberOfPages()}`, 190, 288, { align: 'right' });
  }
  pdf.save(`Stato-Jahresziele-${year}.pdf`);
}
