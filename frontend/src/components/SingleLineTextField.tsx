import type { KeyboardEvent, TextareaHTMLAttributes } from 'react';

type SingleLineTextFieldProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'onChange' | 'rows' | 'value' | 'wrap'
> & { onValueChange: (value: string) => void; value: string };

/** An optically single-line textarea that avoids Android credential heuristics. */
export default function SingleLineTextField({ className = '', onKeyDown, onValueChange, value, ...props }: SingleLineTextFieldProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
    onKeyDown?.(event);
  };
  return <textarea {...props} value={value} rows={1} wrap="off" autoComplete="off" enterKeyHint="done" className={`block resize-none overflow-hidden ${className}`.trim()} onChange={(event) => onValueChange(event.target.value.replace(/[\r\n]+/g, ' '))} onKeyDown={handleKeyDown} />;
}
