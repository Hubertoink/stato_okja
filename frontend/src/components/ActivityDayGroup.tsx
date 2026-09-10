import { useEffect, useRef, type ReactNode } from 'react';
import { Calendar } from 'lucide-react';

/** Day labels stay below the app header until the following day replaces them. */
export default function ActivityDayGroup({ date, label, children }: { date: string; label: string; children: ReactNode }) {
  const section = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const element = section.current;
    const title = heading.current;
    const header = document.querySelector('header.header-surface');
    if (!element || !title || !header) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const top = Math.max(0, header.getBoundingClientRect().bottom);
      element.style.setProperty('--day-sticky-top', `${top}px`);
      title.dataset.stuck = String(element.getBoundingClientRect().top <= top + 0.5);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const measure = () => {
      const dateWidth = title.querySelector('time')?.getBoundingClientRect().width || 0;
      title.style.setProperty('--day-full-width', `${element.clientWidth}px`);
      // Calendar (14), gap (8), horizontal padding (16), and left border (2).
      title.style.setProperty('--day-compact-width', `${Math.ceil(dateWidth + 40)}px`);
      schedule();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    observer.observe(element);
    const date = title.querySelector('time');
    if (date) observer.observe(date);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', schedule, { passive: true, capture: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', schedule, true);
    };
  }, []);

  return <section ref={section} className="activity-day-group" aria-label={label}>
    <h2 ref={heading} className="activity-day-heading"><span><Calendar aria-hidden="true" /><time dateTime={date || undefined}>{label}</time></span></h2>
    <div className="space-y-3">{children}</div>
  </section>;
}
