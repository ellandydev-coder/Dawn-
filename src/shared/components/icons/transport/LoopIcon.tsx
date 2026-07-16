import { IconBase } from '../IconBase';
import type { IconProps } from '../types';

export function LoopIcon(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? 'Loop'}>
      {/* Curva superior con flecha derecha */}
      <path d="M4 9 A 5 5 0 0 1 9 4 L 17 4" />
      <polyline points="14 1 17 4 14 7" />
      {/* Curva inferior con flecha izquierda */}
      <path d="M20 15 A 5 5 0 0 1 15 20 L 7 20" />
      <polyline points="10 23 7 20 10 17" />
    </IconBase>
  );
}