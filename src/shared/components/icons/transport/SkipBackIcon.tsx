import { IconBase } from '../IconBase';
import type { IconProps } from '../types';

export function SkipBackIcon(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? 'Skip back'}>
      <polygon points="19 20 9 12 19 4 19 20" fill="currentColor" />
      <line x1="5" y1="19" x2="5" y2="5" />
    </IconBase>
  );
}