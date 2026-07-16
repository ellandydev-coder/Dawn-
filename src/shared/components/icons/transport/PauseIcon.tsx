import { IconBase } from '../IconBase';
import type { IconProps } from '../types';

export function PauseIcon(props: IconProps) {
  return (
    <IconBase {...props} filled title={props.title ?? 'Pause'}>
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </IconBase>
  );
}