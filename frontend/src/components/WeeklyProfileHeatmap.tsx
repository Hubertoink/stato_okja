import { useMemo, useState, type FocusEvent, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import type { WeeklyProfile, WeeklyProfileSlot } from '@/lib/weeklyProfile';
import { formatWeeklyProfileTime } from '@/lib/weeklyProfile';
import { Button, IconButton } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import Toggle from '@/components/Toggle';

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABELS: Record<number, string> = {
  0: 'So',
  1: 'Mo',
  2: 'Di',
  3: 'Mi',
  4: 'Do',
  5: 'Fr',
  6: 'Sa',
};
const TOOLTIP_GUTTER = 12;
const TOOLTIP_WIDTH = 240;
const TOOLTIP_HEIGHT = 82;

type Props = {
  profile?: WeeklyProfile;
  selectedWeekdays: number[];
  isMobile: boolean;
  chartRef?: (node: HTMLDivElement | null) => void;
  exportActions?: ReactNode;
};

type TooltipPosition = {
  left: number;
  top: number;
  placement: 'above' | 'below';
};

function formatHours(minutes: number) {
  return `${(minutes / 60).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Std.`;
}

function slotLabel(slot: WeeklyProfileSlot) {
  return `${formatWeeklyProfileTime(slot.startMinute)}–${formatWeeklyProfileTime(slot.endMinute)}`;
}

export default function WeeklyProfileHeatmap({
  profile,
  selectedWeekdays,
  isMobile,
  chartRef,
  exportActions,
}: Props) {
  const [mode, setMode] = useState<'offers' | 'participants'>('offers');
  const [fineGrained, setFineGrained] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
  const [mobileDayStart, setMobileDayStart] = useState(0);
  const days = profile?.days || [];
  const visibleDays = useMemo(
    () => (isMobile ? DAY_ORDER.slice(mobileDayStart, mobileDayStart + 3) : DAY_ORDER),
    [isMobile, mobileDayStart],
  );
  const displaySlotMinutes = fineGrained ? profile?.slotMinutes || 30 : 60;
  const displaySlots = useMemo(() => {
    const sourceSlots = profile?.slots || [];
    const sourceSlotMinutes = profile?.slotMinutes || 30;
    if (displaySlotMinutes <= sourceSlotMinutes) return sourceSlots;

    const rangeStart = profile?.rangeStart ?? 8 * 60;
    const buckets = new Map<
      string,
      {
        weekday: number;
        startMinute: number;
        weight: number;
        endMinute: number;
        activityMinutes: number;
        coveredMinutes: number;
        activityCount: number;
        participantTotal: number;
        averageOffers: number;
        coverageFrequency: number;
        averageParticipants: number;
      }
    >();

    sourceSlots.forEach((slot) => {
      const startMinute =
        rangeStart +
        Math.floor((slot.startMinute - rangeStart) / displaySlotMinutes) * displaySlotMinutes;
      const key = `${slot.weekday}:${startMinute}`;
      const weight = Math.max(1, slot.endMinute - slot.startMinute);
      const current = buckets.get(key) || {
        weekday: slot.weekday,
        startMinute,
        weight: 0,
        endMinute: startMinute + displaySlotMinutes,
        activityMinutes: 0,
        coveredMinutes: 0,
        activityCount: 0,
        participantTotal: 0,
        averageOffers: 0,
        coverageFrequency: 0,
        averageParticipants: 0,
      };
      current.weight += weight;
      current.endMinute = Math.max(current.endMinute, slot.endMinute);
      current.activityMinutes += slot.activityMinutes;
      current.coveredMinutes += slot.coveredMinutes;
      current.activityCount += slot.activityCount;
      current.participantTotal += slot.participantTotal;
      current.averageOffers += slot.averageOffers * weight;
      current.coverageFrequency += slot.coverageFrequency * weight;
      current.averageParticipants += slot.averageParticipants * weight;
      buckets.set(key, current);
    });

    return Array.from(buckets.values())
      .map(({ weight, ...slot }) => ({
        ...slot,
        averageOffers: slot.averageOffers / weight,
        coverageFrequency: slot.coverageFrequency / weight,
        averageParticipants: slot.averageParticipants / weight,
      }))
      .sort((left, right) => left.weekday - right.weekday || left.startMinute - right.startMinute);
  }, [displaySlotMinutes, profile]);
  const slotsByKey = useMemo(() => {
    const map = new Map<string, WeeklyProfileSlot>();
    for (const slot of displaySlots) map.set(`${slot.weekday}:${slot.startMinute}`, slot);
    return map;
  }, [displaySlots]);
  const rangeStart = profile?.rangeStart ?? 8 * 60;
  const rangeEnd = profile?.rangeEnd ?? 22 * 60;
  const rowStarts = useMemo(() => {
    const result: number[] = [];
    for (let minute = rangeStart; minute < rangeEnd; minute += displaySlotMinutes)
      result.push(minute);
    return result;
  }, [displaySlotMinutes, rangeEnd, rangeStart]);
  const maxValue = useMemo(() => {
    const values = displaySlots.map((slot) =>
      mode === 'offers' ? slot.averageOffers : slot.averageParticipants,
    );
    return Math.max(1, ...values);
  }, [displaySlots, mode]);
  const bestSlot = useMemo(
    () =>
      [...displaySlots].sort(
        (a, b) =>
          b.averageOffers - a.averageOffers || b.averageParticipants - a.averageParticipants,
      )[0],
    [displaySlots],
  );
  const activeSlot = activeKey ? slotsByKey.get(activeKey) : undefined;

  const clearTooltip = () => {
    setActiveKey(null);
    setTooltipPosition(null);
  };

  const showTooltip = (key: string, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const availableAbove = rect.top - TOOLTIP_GUTTER;
    const availableBelow = viewportHeight - rect.bottom - TOOLTIP_GUTTER;
    const placement: TooltipPosition['placement'] =
      availableBelow >= TOOLTIP_HEIGHT || availableBelow >= availableAbove ? 'below' : 'above';
    const halfWidth = Math.min(TOOLTIP_WIDTH, viewportWidth - TOOLTIP_GUTTER * 2) / 2;
    setActiveKey(key);
    setTooltipPosition({
      left: Math.min(
        viewportWidth - TOOLTIP_GUTTER - halfWidth,
        Math.max(TOOLTIP_GUTTER + halfWidth, rect.left + rect.width / 2),
      ),
      top: placement === 'below' ? rect.bottom + 8 : rect.top - 8,
      placement,
    });
  };

  if (!profile || profile.slots.length === 0) {
    return (
      <div
        ref={chartRef}
        className="statistics-chart-card statistics-weekly-profile group/chart-card rounded-lg p-3 md:p-6"
        data-pdf-section
      >
        <div className="flex items-center gap-3">
          <CalendarDays
            className="statistics-weekly-profile__empty-icon h-5 w-5"
            aria-hidden="true"
          />
          <div>
            <h2 className="statistics-chart-title text-base font-semibold text-viridian">
              Wochenprofil
            </h2>
            <p className="statistics-weekly-profile__empty-copy text-sm">
              Für den gewählten Filter liegen keine Aktivitäten mit Uhrzeit vor.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const onCardClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (!target.closest('[data-weekly-profile-slot]')) clearTooltip();
  };

  return (
    <div
      ref={chartRef}
      className="statistics-chart-card statistics-weekly-profile group/chart-card rounded-lg p-3 md:p-6"
      data-pdf-section
      onClick={onCardClick}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="statistics-chart-title text-lg font-semibold text-viridian">
            Wochenprofil
          </h2>
          {bestSlot && (
            <p className="statistics-weekly-profile__density mt-2 text-xs">
              Höchste Dichte: {DAY_LABELS[bestSlot.weekday]} {slotLabel(bestSlot)} · Ø{' '}
              {bestSlot.averageOffers.toFixed(1)} Angebote parallel
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isMobile && (
            <div
              className="statistics-weekly-profile__mobile-day-pager inline-flex items-center rounded-lg p-1"
              role="group"
              aria-label="Tage auswählen"
            >
              <IconButton
                size="icon-compact"
                variant="ghost"
                className="statistics-weekly-profile__mobile-day-button rounded-md disabled:cursor-not-allowed disabled:opacity-35"
                onClick={() => setMobileDayStart((current) => Math.max(0, current - 1))}
                disabled={mobileDayStart === 0}
                aria-label="Vorherige drei Tage"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </IconButton>
              <span className="statistics-weekly-profile__mobile-day-label min-w-[4.5rem] px-1 text-center text-[11px]">
                {DAY_LABELS[visibleDays[0]]}–{DAY_LABELS[visibleDays[visibleDays.length - 1]]}
              </span>
              <IconButton
                size="icon-compact"
                variant="ghost"
                className="statistics-weekly-profile__mobile-day-button rounded-md disabled:cursor-not-allowed disabled:opacity-35"
                onClick={() =>
                  setMobileDayStart((current) => Math.min(DAY_ORDER.length - 3, current + 1))
                }
                disabled={mobileDayStart >= DAY_ORDER.length - 3}
                aria-label="Nächste drei Tage"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </IconButton>
            </div>
          )}
          {exportActions}
          <Toggle
            checked={fineGrained}
            onChange={(checked) => {
              clearTooltip();
              setFineGrained(checked);
            }}
            label={fineGrained ? '30 Min.' : '1 Std.'}
            ariaLabel="Zeitauflösung des Wochenprofils"
            className="min-h-9"
          />
          <SegmentedControl<'offers' | 'participants'>
            ariaLabel="Darstellung"
            onChange={setMode}
            options={[
              { value: 'offers', label: 'Angebote' },
              { value: 'participants', label: 'Besucher:innen' },
            ]}
            value={mode}
          />
        </div>
      </div>
      <div className="mt-5 overflow-x-auto" role="grid" aria-label="Wochenprofil Heatmap">
        <div
          className={isMobile ? 'min-w-0' : 'min-w-[720px]'}
          style={{ ['--weekly-profile-row-height' as string]: isMobile ? '28px' : '24px' }}
        >
          <div
            className="statistics-weekly-profile__grid-header grid"
            style={{ gridTemplateColumns: `52px repeat(${visibleDays.length}, minmax(0, 1fr))` }}
          >
            <div className="statistics-weekly-profile__time-header px-2 py-2 text-[10px] uppercase tracking-wide">
              Zeit
            </div>
            {visibleDays.map((weekday) => {
              const day = days.find((entry) => entry.weekday === weekday);
              const selected = selectedWeekdays.length === 0 || selectedWeekdays.includes(weekday);
              return (
                <div
                  key={weekday}
                  className={`statistics-weekly-profile__day-header px-2 py-2 ${selected ? '' : 'opacity-40'}`}
                >
                  <div className="statistics-weekly-profile__day-name text-xs">
                    {DAY_LABELS[weekday]}
                  </div>
                  <div className="statistics-weekly-profile__day-meta mt-1 text-[10px]">
                    {formatHours(day?.activityMinutes || 0)} · {day?.activityCount || 0} Angebote
                  </div>
                </div>
              );
            })}
          </div>
          {rowStarts.map((minute) => (
            <div
              key={minute}
              className="grid"
              style={{
                gridTemplateColumns: `52px repeat(${visibleDays.length}, minmax(0, 1fr))`,
                minHeight: 'var(--weekly-profile-row-height)',
              }}
            >
              <div className="statistics-weekly-profile__time-label pr-2 pt-1 text-right text-[10px] tabular-nums">
                {formatWeeklyProfileTime(minute)}
              </div>
              {visibleDays.map((weekday) => {
                const key = `${weekday}:${minute}`;
                const slot = slotsByKey.get(key);
                const selected =
                  selectedWeekdays.length === 0 || selectedWeekdays.includes(weekday);
                const value = slot
                  ? mode === 'offers'
                    ? slot.averageOffers
                    : slot.averageParticipants
                  : 0;
                const intensity =
                  slot && selected
                    ? `${Math.round((0.1 + Math.min(0.78, (value / maxValue) * 0.78)) * 100)}%`
                    : '0%';
                const isActive = activeKey === key;
                return (
                  <Button
                    key={key}
                    size="sm"
                    variant="ghost"
                    type="button"
                    role="gridcell"
                    data-weekly-profile-slot="true"
                    data-export-preserve-background="true"
                    aria-label={`${DAY_LABELS[weekday]} ${formatWeeklyProfileTime(minute)}`}
                    aria-describedby={isActive ? 'weekly-profile-tooltip' : undefined}
                    onMouseEnter={(event) => {
                      if (slot && !isMobile) showTooltip(key, event.currentTarget);
                    }}
                    onMouseLeave={() => !isMobile && clearTooltip()}
                    onFocus={(event: FocusEvent<HTMLButtonElement>) => {
                      if (slot && !isMobile) showTooltip(key, event.currentTarget);
                    }}
                    onBlur={() => !isMobile && clearTooltip()}
                    onClick={(event) => {
                      if (!slot) return;
                      if (isActive) clearTooltip();
                      else showTooltip(key, event.currentTarget);
                    }}
                    className={`statistics-weekly-profile__slot statistics-weekly-profile__slot--${mode} relative !inline-block !h-full !min-h-0 !w-full !rounded-none !p-0 text-left transition-colors ${selected ? '' : 'statistics-weekly-profile__slot--muted'}`}
                    style={{ ['--weekly-profile-slot-intensity' as string]: intensity }}
                  >
                    <span aria-hidden="true" />
                  </Button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {activeSlot &&
        tooltipPosition &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            id="weekly-profile-tooltip"
            role="tooltip"
            className="statistics-chart-tooltip fixed z-[80] w-[min(15rem,calc(100vw-1.5rem))] px-3 py-2 text-left text-sm leading-5"
            style={{
              left: tooltipPosition.left,
              top: tooltipPosition.top,
              transform:
                tooltipPosition.placement === 'above'
                  ? 'translate(-50%, -100%)'
                  : 'translate(-50%, 0)',
            }}
          >
            <span className="statistics-chart-tooltip-label block">
              {DAY_LABELS[activeSlot.weekday]} {slotLabel(activeSlot)}
            </span>
            <span className="statistics-chart-tooltip-value block">
              {activeSlot.averageOffers.toFixed(1)} Angebote parallel
            </span>
            <span className="statistics-chart-tooltip-value block">
              {activeSlot.averageParticipants.toFixed(1)} Besucher:innen je Angebot
            </span>
          </div>,
          document.body,
        )}
      {profile.excludedWithoutTime > 0 && (
        <p className="statistics-weekly-profile__exclusion-note mt-2 text-[11px]">
          {profile.excludedWithoutTime} Aktivität(en) ohne vollständige Uhrzeit wurden nicht in die
          Heatmap aufgenommen.
        </p>
      )}
    </div>
  );
}
