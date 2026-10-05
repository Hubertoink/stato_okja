import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ColorPicker } from './ColorPicker';
import { Input } from './Field';

function setDevice(mobile: boolean) {
  vi.stubGlobal('innerWidth', mobile ? 390 : 1280);
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: mobile })));
}

describe('ColorPicker', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('opens the picker from the mobile color value without an editable input', async () => {
    setDevice(true);
    const onChange = vi.fn();
    render(<ColorPicker value="#0f766e" onChange={onChange} />);
    const trigger = screen.getByRole('button', { name: 'Farbwert als Hexadezimalzahl' });
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    await userEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Farbe auswählen' })).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.change(screen.getAllByRole('slider')[0], { target: { value: '180' } });
    expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/^#[0-9a-f]{6}$/));
  });

  it('releases the previous text field when a mobile browser keeps it focused on tap', () => {
    setDevice(true);
    render(<><Input aria-label="Name" /><ColorPicker onChange={vi.fn()} /></>);
    const field = screen.getByRole('textbox', { name: 'Name' });
    field.focus();
    // fireEvent.click deliberately does not transfer focus, matching iOS taps.
    fireEvent.click(screen.getByRole('button', { name: 'Farbwert als Hexadezimalzahl' }));
    expect(field).not.toHaveFocus();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('still accepts typed hexadecimal colors on desktop', () => {
    setDevice(false);
    const onChange = vi.fn();
    render(<ColorPicker onChange={onChange} />);
    const field = screen.getByRole('textbox', { name: 'Farbwert als Hexadezimalzahl' });
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: '#abcdef' } });
    expect(onChange).toHaveBeenCalledWith('#abcdef');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not open a disabled mobile picker', async () => {
    setDevice(true);
    render(<ColorPicker disabled onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Farbwert als Hexadezimalzahl' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('repositions inside the visible viewport while the previous keyboard closes', () => {
    setDevice(true);
    const viewport = Object.assign(new EventTarget(), { width: 390, height: 400, offsetTop: 100, offsetLeft: 0 });
    vi.stubGlobal('visualViewport', viewport);
    render(<ColorPicker onChange={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Farbwert als Hexadezimalzahl' });
    const anchor = trigger.parentElement!.parentElement!;
    vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({ top: 400, bottom: 440, left: 12, right: 378, width: 366, height: 40, x: 12, y: 400, toJSON: () => undefined });
    fireEvent.click(trigger);
    const picker = screen.getByRole('dialog');
    expect(Number.parseFloat(picker.style.top)).toBeGreaterThanOrEqual(112);
    expect(Number.parseFloat(picker.style.top) + 240).toBeLessThanOrEqual(488);

    act(() => {
      viewport.height = 800;
      viewport.offsetTop = 0;
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(picker).toHaveStyle({ top: '450px' });
  });
});
