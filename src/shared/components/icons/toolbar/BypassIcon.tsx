import { IconBase } from '../IconBase';
import type { IconProps } from '../types';

export function BypassIcon(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? 'Bypass'}>
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </IconBase>
  );
}