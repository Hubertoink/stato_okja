import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Input, Textarea } from '@/components/ui/Field';
import { useDismissKeyboardOnScroll } from './useDismissKeyboardOnScroll';

function Fixture() {
  useDismissKeyboardOnScroll();
  return (
    <>
      <Input aria-label="Search" defaultValue="Demo" />
      <Textarea aria-label="Notes" />
      <div contentEditable suppressContentEditableWarning data-testid="editor"><span>Editable text</span></div>
      <div role="dialog" onTouchMove={(event) => event.stopPropagation()}>
        <div data-testid="scroller">Project list</div>
      </div>
    </>
  );
}

const touch = (clientY: number, identifier = 1) => ({ identifier, clientX: 30, clientY });

describe('useDismissKeyboardOnScroll', () => {
  it('blurs the search on a swipe in a modal and retains its value', () => {
    render(<Fixture />);
    const input = screen.getByRole('textbox', { name: 'Search' });
    const scroller = screen.getByTestId('scroller');
    input.focus();

    fireEvent.touchStart(scroller, { touches: [touch(100)] });
    const allowed = fireEvent.touchMove(scroller, { touches: [touch(60)] });

    expect(input).not.toHaveFocus();
    expect(input).toHaveValue('Demo');
    expect(allowed).toBe(true);
  });

  it('keeps focus during a tap or small finger movement', () => {
    render(<Fixture />);
    const input = screen.getByRole('textbox', { name: 'Search' });
    const scroller = screen.getByTestId('scroller');
    input.focus();
    fireEvent.touchStart(scroller, { touches: [touch(100)] });
    fireEvent.touchMove(scroller, { touches: [touch(96)] });
    fireEvent.touchEnd(scroller, { touches: [] });
    fireEvent.touchMove(scroller, { touches: [touch(60)] });
    expect(input).toHaveFocus();
  });

  it.each(['Search', 'Notes', 'editor'])('preserves editing gestures inside %s', (name) => {
    render(<Fixture />);
    const field = name === 'editor' ? screen.getByTestId('editor') : screen.getByRole('textbox', { name });
    field.focus();
    const target = field.firstElementChild ?? field;
    fireEvent.touchStart(target, { touches: [touch(100)] });
    fireEvent.touchMove(target, { touches: [touch(60)] });
    expect(field).toHaveFocus();
  });

  it('dismisses the keyboard for a focused rich text editor when swiping outside it', () => {
    render(<Fixture />);
    const editor = screen.getByTestId('editor');
    editor.focus();
    const scroller = screen.getByTestId('scroller');
    fireEvent.touchStart(scroller, { touches: [touch(100)] });
    fireEvent.touchMove(scroller, { touches: [touch(60)] });
    expect(editor).not.toHaveFocus();
  });

  it('dismisses when a swipe starting on a field scrolls the surrounding modal', () => {
    render(<Fixture />);
    const input = screen.getByRole('textbox', { name: 'Search' });
    input.focus();
    fireEvent.touchStart(input, { touches: [touch(100)] });
    fireEvent.touchMove(input, { touches: [touch(60)] });
    expect(input).toHaveFocus();
    fireEvent.scroll(screen.getByTestId('scroller'));
    expect(input).not.toHaveFocus();
  });

  it('keeps focus when a swipe scrolls the textarea itself', () => {
    render(<Fixture />);
    const notes = screen.getByRole('textbox', { name: 'Notes' });
    notes.focus();
    fireEvent.touchStart(notes, { touches: [touch(100)] });
    fireEvent.touchMove(notes, { touches: [touch(60)] });
    fireEvent.scroll(notes);
    expect(notes).toHaveFocus();
  });

  it('preserves focus when the browser or app scrolls without a swipe', () => {
    render(<Fixture />);
    const input = screen.getByRole('textbox', { name: 'Search' });
    input.focus();
    fireEvent.scroll(window);
    fireEvent.scroll(screen.getByTestId('scroller'));
    fireEvent.touchMove(screen.getByTestId('scroller'), { touches: [touch(60)] });
    expect(input).toHaveFocus();
  });

  it('ignores pinch gestures and cancelled touches', () => {
    render(<Fixture />);
    const input = screen.getByRole('textbox', { name: 'Search' });
    const scroller = screen.getByTestId('scroller');
    input.focus();
    fireEvent.touchStart(scroller, { touches: [touch(100)] });
    fireEvent.touchMove(scroller, { touches: [touch(60), touch(120, 2)] });
    fireEvent.touchMove(scroller, { touches: [touch(60)] });
    expect(input).toHaveFocus();
    fireEvent.touchStart(scroller, { touches: [touch(100)] });
    fireEvent.touchCancel(scroller, { touches: [] });
    fireEvent.touchMove(scroller, { touches: [touch(60)] });
    expect(input).toHaveFocus();
  });

  it('does not blur a field focused after the swipe starts', () => {
    render(<Fixture />);
    screen.getByRole('textbox', { name: 'Search' }).focus();
    const scroller = screen.getByTestId('scroller');
    fireEvent.touchStart(scroller, { touches: [touch(100)] });
    const notes = screen.getByRole('textbox', { name: 'Notes' });
    notes.focus();
    fireEvent.touchMove(scroller, { touches: [touch(60)] });
    expect(notes).toHaveFocus();
  });

  it('removes global handlers on unmount', () => {
    const { unmount } = render(<Fixture />);
    screen.getByRole('textbox', { name: 'Search' }).focus();
    fireEvent.touchStart(screen.getByTestId('scroller'), { touches: [touch(100)] });
    unmount();
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    fireEvent.touchStart(document.body, { touches: [touch(100)] });
    fireEvent.touchMove(document.body, { touches: [touch(60)] });
    expect(input).toHaveFocus();
    input.remove();
  });
});
