import { IconBase } from '../IconBase';
import type { IconProps } from '../types';

export function OpenProjectIcon(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? 'Abrir proyecto'}>
      {/* Bandeja */}
      <path d="M3 15v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3" />
      {/* Flecha saliendo hacia arriba */}
      <polyline points="8 8 12 4 16 8" />
      <line x1="12" y1="4" x2="12" y2="15" />
    </IconBase>
  );
}