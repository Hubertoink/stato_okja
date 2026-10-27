import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { enableNativeKeyboardViewport, getKeyboardViewport, getNativeKeyboard, KEYBOARD_VIEWPORT_EVENT, nativeKeyboardViewportActive } from '@/lib/keyboardViewport';

const round = (value: number) => Math.round(value * 100) / 100;

function geometry(element: Element | null) {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return {
    top: round(rect.top), bottom: round(rect.bottom), height: round(rect.height),
    scrollTop: round(element.scrollTop), clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  };
}

function measure(fixedProbe: Element | null, dvhProbe: Element | null) {
  const root = document.documentElement;
  const style = getComputedStyle(root);
  const vv = window.visualViewport;
  const keyboard = getNativeKeyboard();
  const bounds = keyboard?.boundingRect;
  const dialog = [...document.querySelectorAll('.modal-overlay [role="dialog"]')].at(-1) ?? null;
  const shell = dialog?.closest('.modal-overlay') ?? null;
  const field = dialog?.contains(document.activeElement) ? document.activeElement : null;
  return {
    window: { width: innerWidth, height: innerHeight, clientHeight: root.clientHeight, scrollY: round(scrollY) },
    visualViewport: vv ? {
      height: round(vv.height), width: round(vv.width), offsetTop: round(vv.offsetTop),
      pageTop: round(vv.pageTop), scale: round(vv.scale),
    } : null,
    effectiveViewport: getKeyboardViewport(),
    virtualKeyboard: keyboard && bounds ? {
      enabled: nativeKeyboardViewportActive(), overlaysContent: keyboard.overlaysContent,
      top: round(bounds.top), bottom: round(bounds.bottom), height: round(bounds.height),
      left: round(bounds.left), width: round(bounds.width),
    } : null,
    css: {
      height: style.getPropertyValue('--visual-viewport-height').trim(),
      fixedHeight: style.getPropertyValue('--visual-viewport-fixed-height').trim(),
      offsetTop: style.getPropertyValue('--visual-viewport-offset-top').trim(),
      keyboardInset: style.getPropertyValue('--keyboard-inset-height').trim(),
      keyboardOpen: root.dataset.keyboardOpen ?? null,
      bodyPosition: getComputedStyle(document.body).position,
      safeAreaBottom: dvhProbe ? getComputedStyle(dvhProbe).paddingBottom : null,
    },
    // These probes measure CSS layout, not a ground truth for physical keyboard bounds.
    nativeFixed: geometry(fixedProbe), dvh: geometry(dvhProbe),
    shell: geometry(shell), dialog: geometry(dialog),
    footer: geometry(dialog?.querySelector('[data-scroll-footer]') ?? null),
    // Deliberately omit values, text, IDs, URLs and user/account data.
    focus: { tag: field?.tagName ?? null, bounds: geometry(field) },
  };
}

type Measurement = ReturnType<typeof measure>;
type Sample = { ms: number; event: string; data: Measurement };

/** Opt-in, local-only capture for /master-data?viewportDebug=1. */
export default function ViewportDiagnostics({ nativeKeyboard = false }: { nativeKeyboard?: boolean }) {
  const fixedProbe = useRef<HTMLDivElement>(null);
  const dvhProbe = useRef<HTMLDivElement>(null);
  const samples = useRef<Sample[]>([]);
  const captureRef = useRef<(event: string) => void>(() => {});
  const [latest, setLatest] = useState<Measurement | null>(null);
  const [copyStatus, setCopyStatus] = useState('Messwerte kopieren');
  const [nativeOverride, setNativeOverride] = useState<boolean | null>(null);
  const nativeRequested = nativeOverride ?? nativeKeyboard;

  useEffect(() => {
    if (nativeRequested) return enableNativeKeyboardViewport();
  }, [nativeRequested]);

  useEffect(() => {
    const start = performance.now();
    let lastSignature = '';
    samples.current = [];
    const capture = (event: string) => {
      const data = measure(fixedProbe.current, dvhProbe.current);
      const signature = JSON.stringify(data);
      // Poll independently of browser events to catch silently changing API values.
      if (event === 'poll' && signature === lastSignature) return;
      if (signature !== lastSignature) setLatest(data);
      lastSignature = signature;
      samples.current.push({ ms: round(performance.now() - start), event, data });
      if (samples.current.length > 240) samples.current.splice(1, 1);
    };
    captureRef.current = capture;
    capture('start');
    const onWindow = (event: Event) => capture(`window.${event.type}`);
    const onViewport = (event: Event) => capture(`visualViewport.${event.type}`);
    const windowEvents = ['resize', 'scroll', 'focusin', 'focusout', 'orientationchange', KEYBOARD_VIEWPORT_EVENT];
    windowEvents.forEach((event) => window.addEventListener(event, onWindow));
    const vv = window.visualViewport;
    vv?.addEventListener('resize', onViewport);
    vv?.addEventListener('scroll', onViewport);
    const interval = window.setInterval(() => {
      if (!document.hidden) capture('poll');
    }, 200);
    return () => {
      window.clearInterval(interval);
      windowEvents.forEach((event) => window.removeEventListener(event, onWindow));
      vv?.removeEventListener('resize', onViewport);
      vv?.removeEventListener('scroll', onViewport);
      captureRef.current = () => {};
    };
  }, []);

  const copy = async () => {
    captureRef.current('copy');
    const reportData = {
      diagnostic: 'master-data-viewport-v3', nativeKeyboardRequested: nativeRequested, userAgent: navigator.userAgent,
      omittedSamples: 0, samples: [...samples.current],
    };
    let report = JSON.stringify(reportData);
    // Pasted phone reports can be cut off at 64 KiB. Keep complete JSON,
    // the initial baseline and the latest samples comfortably below that limit.
    while (report.length > 48_000 && reportData.samples.length > 2) {
      reportData.samples.splice(1, 1);
      reportData.omittedSamples++;
      report = JSON.stringify(reportData);
    }
    try {
      await navigator.clipboard.writeText(report);
      setCopyStatus('Kopiert');
    } catch {
      setCopyStatus('Kopieren fehlgeschlagen – Screenshot möglich');
    }
  };

  return createPortal(
    <>
      <div ref={fixedProbe} aria-hidden="true" style={{ position: 'fixed', inset: 0, visibility: 'hidden', pointerEvents: 'none' }} />
      <div ref={dvhProbe} aria-hidden="true" style={{ position: 'fixed', top: 0, width: 0, height: '100dvh', boxSizing: 'border-box', paddingBottom: 'env(safe-area-inset-bottom, 0px)', visibility: 'hidden', pointerEvents: 'none' }} />
      <aside
        aria-label="Viewport-Diagnose"
        className="fixed right-1 z-[100] max-w-[calc(100%-0.5rem)] rounded-lg bg-slate-950 p-2 text-xs text-white shadow-lg"
        style={{ top: 'calc(var(--visual-viewport-offset-top, 0px) + 4px)', pointerEvents: 'none' }}
      >
        <div className="font-mono">
          VV {latest?.visualViewport?.height ?? '–'} · CSS {latest?.css.fixedHeight ? round(parseFloat(latest.css.fixedHeight)) : '–'} · Offset {latest?.visualViewport?.offsetTop ?? '–'}
          <br />
          Modal unten {latest?.shell?.bottom ?? '–'} · Fenster {latest?.window.height ?? '–'} · dvh {latest?.dvh?.height ?? '–'}
          <br />
          VK oben {latest?.virtualKeyboard?.top ?? '–'} · {nativeRequested ? latest?.virtualKeyboard?.enabled ? 'Nativ-Test aktiv' : 'Nativ-Test nicht verfügbar' : 'Standard'}
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
        <Button
          size="sm" variant="secondary" style={{ pointerEvents: 'auto', color: '#111827', backgroundColor: '#fff' }}
          // Retain the field focus and keyboard while capturing on a touch device.
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => void copy()}
        >
          {copyStatus}
        </Button>
        <Button
          size="sm" variant="secondary" style={{ pointerEvents: 'auto', color: '#111827', backgroundColor: '#fff' }}
          aria-pressed={nativeRequested}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => {
            setNativeOverride(!nativeRequested);
            setCopyStatus('Messwerte kopieren');
          }}
        >
          {nativeRequested ? 'Zurück zu Standard' : 'Nativ-Test starten'}
        </Button>
        </div>
        {nativeOverride !== null && <div className="mt-1">Tastatur jetzt schließen und erneut öffnen.</div>}
      </aside>
    </>,
    document.body,
  );
}
