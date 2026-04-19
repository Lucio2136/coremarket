import * as LucideIcons from 'lucide-react';
import type { LucideProps } from 'lucide-react';

type IconName = keyof typeof LucideIcons;
type Size = 12 | 14 | 16 | 20 | 24;

interface IconProps extends Omit<LucideProps, 'size'> {
  name: IconName;
  size?: Size;
}

export function Icon({ name, size = 16, strokeWidth = 1.75, ...rest }: IconProps) {
  const Cmp = LucideIcons[name] as React.ComponentType<LucideProps>;
  if (!Cmp) return null;
  return <Cmp size={size} strokeWidth={strokeWidth} {...rest} />;
}
