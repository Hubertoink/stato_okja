import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { targetTypes, useTargetActivities } from '@/lib/annualTargets';
import './AnnualTargetCards.css';

export default function AnnualTargetActivities({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const query = useTargetActivities(id, page);
  const headingId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const data = query.data;
  const changingPage = query.isPlaceholderData || query.isPending;
  const displayedPage = data?.page ?? page;
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [data?.page]);

  return (
    <section aria-labelledby={headingId} className="annual-target-activities">
      <h3 id={headingId} className="font-semibold">
        Zugehörige Aktivitäten
      </h3>
      <p className="annual-target-activities-status" role="status">
        {query.isFetching
          ? query.isPlaceholderData
            ? `Seite ${page} wird geladen …`
            : 'Aktivitäten werden geladen …'
          : 'Aktueller Datenstand'}
      </p>
      <div
        ref={listRef}
        className="annual-target-activities-list"
        role="region"
        aria-label="Aktivitätenliste"
        aria-busy={query.isFetching}
        tabIndex={0}
      >
        {query.isPending ? (
          <p className="annual-target-activities-message">Aktivitäten werden geladen …</p>
        ) : query.isError ? (
          <div className="annual-target-activities-message">
            <p role="alert">Aktivitäten konnten nicht geladen werden.</p>
            <Button variant="secondary" onClick={() => void query.refetch()}>
              Erneut versuchen
            </Button>
          </div>
        ) : (
          <ul>
            {data?.items.map((activity) => (
              <li key={activity.id}>
                <Link to={`/activities/${activity.id}`}>
                  <span className="annual-target-activity-date">
                    {activity.date.split('-').reverse().join('.')}
                  </span>
                  <span>{activity.title || targetTypes[activity.type]}</span>
                </Link>
                <span className="annual-target-activity-counts">
                  {activity.durationMinutes ?? 0} Min. · {activity.countTotal ?? 0} Besuche
                </span>
              </li>
            ))}
            {!data?.total && <li>Keine durchgeführten Aktivitäten bis zum Stichtag.</li>}
          </ul>
        )}
      </div>
      <nav className="annual-target-activities-pagination" aria-label="Aktivitätenseiten">
        <Button
          variant="secondary"
          disabled={page === 1 || changingPage}
          onClick={() => setPage(page - 1)}
        >
          Zurück
        </Button>
        <span>
          Seite {displayedPage}
          {data
            ? ` von ${Math.max(1, Math.ceil(data.total / data.pageSize))} · ${data.total} Aktivitäten`
            : ''}
        </span>
        <Button
          variant="secondary"
          disabled={changingPage || !data || page * data.pageSize >= data.total}
          onClick={() => setPage(page + 1)}
        >
          Weiter
        </Button>
      </nav>
    </section>
  );
}
