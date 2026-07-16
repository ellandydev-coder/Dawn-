import { IconBase } from '../IconBase';
import type { IconProps } from '../types';

export function VolumeMuteIcon(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? 'Muted'}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </IconBase>
  );
}