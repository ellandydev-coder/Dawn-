import { IconBase } from '../IconBase';
import type { IconProps } from '../types';

export function EnvelopeIcon(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? 'Envolvente'}>
      <path d="M4 15c0-4 3-8 8-8s8 4 8 8" />
      <polyline points="17 12 20 15 17 18" />
    </IconBase>
  );
}