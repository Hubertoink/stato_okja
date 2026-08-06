import type { KeyboardEvent, TextareaHTMLAttributes } from 'react';

type ActivityTitleFieldProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'onChange' | 'rows' | 'value' | 'wrap'
> & {
  onValueChange: (value: string) => void;
  value: string;
};

/**
 * A visually single-line title field that avoids Android password-manager
 * heuristics targeting ordinary text inputs. Activity titles remain single
 * line even when text containing line breaks is pasted.
 */
export default function ActivityTitleField({
  className = '',
  onKeyDown,
  onValueChange,
  value,
  ...props
}: ActivityTitleFieldProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
    }
    onKeyDown?.(event);
  };

  return (
    <textarea
      {...props}
      value={value}
      rows={1}
      wrap="off"
      autoComplete="off"
      enterKeyHint="done"
      className={`block resize-none overflow-hidden ${className}`.trim()}
      onChange={(event) => onValueChange(event.target.value.replace(/[\r\n]+/g, ' '))}
      onKeyDown={handleKeyDown}
    />
  );
}
