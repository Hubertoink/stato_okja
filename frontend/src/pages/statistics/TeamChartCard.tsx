import { useRef, useState, type ReactNode } from 'react';
import { captureExportNode } from '@/lib/htmlCanvasExport';
import { useProgressToast, useToast } from '@/components/Toast';
import { StatisticsExportActions } from '../StatisticsExportActions';

export function TeamChartCard({ title, children }: { title: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const lock = useRef(false);
  const [exporting, setExporting] = useState(false);
  const { showToast } = useToast();
  useProgressToast(exporting, 'Diagramm wird als Bild aufbereitet …');

  async function exportPng() {
    if (!ref.current || lock.current) return;
    lock.current = true;
    setExporting(true);
    try {
      const canvas = await captureExportNode(ref.current, {
        scale: 2,
        ignoreElements: (element) => element.getAttribute('data-chart-export-ignore') === 'true'
          || element.classList.contains('recharts-tooltip-wrapper'),
      });
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => value ? resolve(value) : reject(new Error('PNG export failed')));
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Stato-Team-${title.replace(/[^\p{L}\p{N}]+/gu, '-')}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      showToast('Das Diagramm konnte nicht exportiert werden. Bitte erneut versuchen.', { type: 'error' });
    } finally {
      lock.current = false;
      setExporting(false);
    }
  }

  return <section ref={ref} aria-label={title}
    className="group/chart-card min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4 sm:p-6">
    <div className="flex items-start justify-between gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div data-chart-export-ignore="true">
        <StatisticsExportActions triggerLabel={`${title} exportieren`} menuTitle="Diagramm exportieren"
          isExporting={exporting} options={[{ label: 'PNG', meta: 'Bild', onClick: () => void exportPng() }]} />
      </div>
    </div>
    {children}
  </section>;
}
