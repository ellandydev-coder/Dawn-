import { IconBase } from '../IconBase';
import type { IconProps } from '../types';

export function AutomationIcon(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? 'Automatización'}>
      <path d="M3 12 Q 7 6, 12 12 T 21 12" />
    </IconBase>
  );
}