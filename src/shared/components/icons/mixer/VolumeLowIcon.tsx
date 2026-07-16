import { IconBase } from '../IconBase';
import type { IconProps } from '../types';

export function VolumeLowIcon(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? 'Low volume'}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </IconBase>
  );
}