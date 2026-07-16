import { IconBase } from '../IconBase';
import type { IconProps } from '../types';

export function StopIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="6" y="6" width="12" height="12" fill="currentColor" />
    </IconBase>
  );
}