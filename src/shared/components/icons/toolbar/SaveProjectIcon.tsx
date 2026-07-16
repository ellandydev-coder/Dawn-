import { IconBase } from '../IconBase';
import type { IconProps } from '../types';

export function SaveProjectIcon(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? 'Guardar proyecto'}>
      {/* Bandeja */}
      <path d="M3 15v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3" />
      {/* Flecha entrando hacia abajo */}
      <polyline points="8 11 12 15 16 11" />
      <line x1="12" y1="4" x2="12" y2="15" />
    </IconBase>
  );
}