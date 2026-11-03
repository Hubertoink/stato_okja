import '@/components/ui/DataTransition.css';

const card = 'rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4 sm:p-6';

export function TeamStatisticsSkeleton({ participation, activities }: { participation: boolean; activities: boolean }) {
  return <div aria-busy="true" aria-label="Team-Statistik" className="space-y-6">
    <div aria-hidden="true" className="space-y-6">
      <div className="statistics-kpi-grid">
        {[0, 1, 2, 3].map((key) => <div key={key} className={card}>
          <div className="skeleton-shimmer h-8 w-20 rounded" />
          <div className="skeleton-shimmer mt-3 h-3 w-3/4 rounded" />
        </div>)}
      </div>
      {participation && <div className={card}>
        <div className="skeleton-shimmer h-5 w-3/5 max-w-80 rounded" />
        <div className="mt-6 grid items-center gap-6 md:grid-cols-2">
          <div className="skeleton-shimmer mx-auto h-56 w-56 max-w-full rounded-full" />
          <div className="space-y-4">{[0, 1, 2, 3].map((key) => <div key={key} className="skeleton-shimmer h-6 rounded" />)}</div>
        </div>
      </div>}
      <ChartSkeleton tall />
      <div className="grid gap-6 xl:grid-cols-2"><ChartSkeleton /><ChartSkeleton /></div>
      {activities && <div className={card}>
        <div className="skeleton-shimmer mb-6 h-5 w-48 max-w-full rounded" />
        <div className="space-y-3">{[0, 1, 2, 3, 4, 5].map((key) => <div key={key} className="skeleton-shimmer h-7 rounded" />)}</div>
      </div>}
    </div>
  </div>;
}

function ChartSkeleton({ tall = false }: { tall?: boolean }) {
  return <div className={card}>
    <div className="skeleton-shimmer h-5 w-3/5 max-w-72 rounded" />
    <div className={`skeleton-shimmer mt-4 rounded-xl ${tall ? 'h-[420px]' : 'h-72'}`} />
  </div>;
}
