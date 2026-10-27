import { createContext, useContext, type ReactElement } from 'react';
import { Tooltip } from '@/components/ui/Tooltip';

export const SidebarIconOnlyContext = createContext(false);

/** Use the shared app tooltip only while sidebar labels are hidden. */
export default function SidebarTooltip({
  text,
  children,
  suppress = false,
}: {
  text: string;
  children: ReactElement<{ 'aria-describedby'?: string; title?: string }>;
  suppress?: boolean;
}) {
  const iconOnly = useContext(SidebarIconOnlyContext);
  return iconOnly ? (
    <Tooltip text={text} placement="right" enabled={!suppress}>
      {children}
    </Tooltip>
  ) : (
    children
  );
}
