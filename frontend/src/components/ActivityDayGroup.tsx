import { useEffect, useRef, type ReactNode } from 'react';
import { Calendar } from 'lucide-react';

/** Day labels stay below the app header until the following day replaces them. */
export default function ActivityDayGroup({ date, label, children }: { date: string; label: string; children: ReactNode }) {
  const section = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = section.current;
    const header = document.querySelector('header.header-surface');
    if (!element || !header) return;
    const update = () => {
      element.style.setProperty('--day-sticky-top', `${Math.max(0, header.getBoundingClientRect().bottom)}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  return <section ref={section} className="activity-day-group" aria-label={label}>
    <h2 className="activity-day-heading"><span><Calendar aria-hidden="true" /><time dateTime={date || undefined}>{label}</time></span></h2>
    <div className="space-y-3">{children}</div>
  </section>;
}
