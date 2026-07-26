import { useEffect, useId, useRef, useState } from 'react';
import { Dices } from 'lucide-react';

type Hsl = { h: number; s: number; l: number };

function hslToHex({ h, s, l }: Hsl) {
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const section = h / 60;
  const secondary = chroma * (1 - Math.abs((section % 2) - 1));
  const [red, green, blue] =
    section < 1 ? [chroma, secondary, 0]
      : section < 2 ? [secondary, chroma, 0]
        : section < 3 ? [0, chroma, secondary]
          : section < 4 ? [0, secondary, chroma]
            : section < 5 ? [secondary, 0, chroma]
              : [chroma, 0, secondary];
  const match = lightness - chroma / 2;
  const toHex = (channel: number) => Math.round((channel + match) * 255).toString(16).padStart(2, '0');
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

function hexToHsl(hex: string): Hsl {
  const normalized = normalizeHex(hex);
  if (!normalized) return { h: 162, s: 78, l: 27 };
  const red = Number.parseInt(normalized.slice(1, 3), 16) / 255;
  const green = Number.parseInt(normalized.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(normalized.slice(5, 7), 16) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  let hue = 0;
  if (delta) {
    if (maximum === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (maximum === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  const lightness = (maximum + minimum) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  return { h: Math.round((hue + 360) % 360), s: Math.round(saturation * 100), l: Math.round(lightness * 100) };
}

function normalizeHex(value?: string | null) {
  const trimmed = value?.trim() || '';
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return /^#[0-9a-f]{6}$/i.test(withHash) ? withHash.toLowerCase() : null;
}

function randomColor() {
  return hslToHex({
    h: Math.floor(Math.random() * 360),
    s: 62 + Math.floor(Math.random() * 19),
    l: 36 + Math.floor(Math.random() * 13),
  });
}

export function ColorPicker({
  value,
  onChange,
  id,
  disabled = false,
}: {
  value?: string | null;
  onChange: (color: string) => void;
  id?: string;
  disabled?: boolean;
}) {
  const generatedId = useId();
  const inputId = id || `color-picker-${generatedId}`;
  const currentColor = normalizeHex(value) || '#0f766e';
  const [open, setOpen] = useState(false);
  const [hexInput, setHexInput] = useState(currentColor);
  const rootRef = useRef<HTMLDivElement>(null);
  const hsl = hexToHsl(currentColor);

  useEffect(() => setHexInput(currentColor), [currentColor]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const setHsl = (next: Partial<Hsl>) => onChange(hslToHex({ ...hsl, ...next }));
  const updateHex = (nextValue: string) => {
    setHexInput(nextValue);
    const validColor = normalizeHex(nextValue);
    if (validColor) onChange(validColor);
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="flex h-10 overflow-hidden rounded-lg border border-[var(--border-strong)] bg-[var(--surface-1)] shadow-sm focus-within:border-[var(--viridian)] focus-within:ring-2 focus-within:ring-[var(--focus-ring)]">
        <button
          type="button"
          className="w-10 shrink-0 border-r border-black/10 transition-opacity hover:opacity-85 disabled:cursor-not-allowed"
          style={{ backgroundColor: currentColor }}
          onClick={() => setOpen((current) => !current)}
          aria-label="Farbauswahl öffnen"
          aria-expanded={open}
          aria-controls={`${inputId}-popover`}
          disabled={disabled}
        />
        <input
          id={inputId}
          value={hexInput}
          onFocus={() => setOpen(true)}
          onChange={(event) => updateHex(event.target.value)}
          onBlur={() => setHexInput(currentColor)}
          inputMode="text"
          spellCheck={false}
          maxLength={7}
          className="min-w-0 flex-1 bg-transparent px-3 font-mono text-sm uppercase text-[var(--text-primary)] outline-none disabled:cursor-not-allowed"
          aria-label="Farbwert als Hexadezimalzahl"
          disabled={disabled}
        />
        <button
          type="button"
          className="grid w-10 shrink-0 place-items-center border-l border-[var(--border-subtle)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--viridian)] disabled:cursor-not-allowed"
          onClick={() => onChange(randomColor())}
          aria-label="Zufällige Farbe erzeugen"
          title="Zufällige Farbe erzeugen"
          disabled={disabled}
        >
          <Dices className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {open ? (
        <div
          id={`${inputId}-popover`}
          className="absolute left-1/2 z-[90] mt-2 w-64 -translate-x-1/2 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-elevated)] p-4 shadow-xl"
          role="dialog"
          aria-label="Farbe auswählen"
        >
          <div className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-l border-t border-[var(--border-strong)] bg-[var(--surface-elevated)]" />
          <div className="relative space-y-3">
            <label className="block text-xs font-medium text-[var(--text-secondary)]" htmlFor={`${inputId}-hue`}>
              Farbton
            </label>
            <input
              id={`${inputId}-hue`}
              type="range"
              min="0"
              max="359"
              value={hsl.h}
              onChange={(event) => setHsl({ h: Number(event.target.value) })}
              className="h-3 w-full cursor-pointer appearance-none rounded-full"
              style={{ background: 'linear-gradient(90deg, #ef4444, #f59e0b, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #ef4444)' }}
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)]" htmlFor={`${inputId}-saturation`}>
                  Sättigung
                </label>
                <input
                  id={`${inputId}-saturation`}
                  type="range"
                  min="20"
                  max="100"
                  value={hsl.s}
                  onChange={(event) => setHsl({ s: Number(event.target.value) })}
                  className="mt-1 h-2 w-full cursor-pointer appearance-none rounded-full"
                  style={{ background: `linear-gradient(90deg, hsl(${hsl.h} 0% ${hsl.l}%), hsl(${hsl.h} 100% ${hsl.l}%))` }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)]" htmlFor={`${inputId}-lightness`}>
                  Helligkeit
                </label>
                <input
                  id={`${inputId}-lightness`}
                  type="range"
                  min="20"
                  max="75"
                  value={hsl.l}
                  onChange={(event) => setHsl({ l: Number(event.target.value) })}
                  className="mt-1 h-2 w-full cursor-pointer appearance-none rounded-full"
                  style={{ background: `linear-gradient(90deg, hsl(${hsl.h} ${hsl.s}% 20%), hsl(${hsl.h} ${hsl.s}% 75%))` }}
                />
              </div>
            </div>
            <button
              type="button"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--viridian)]"
              onClick={() => onChange(randomColor())}
            >
              <Dices className="h-4 w-4" aria-hidden="true" /> Zufällige Farbe
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
