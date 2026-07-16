import { IconBase } from '../IconBase';
import type { IconProps } from '../types';

export function TimeSelectionIcon(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? 'Selección de tiempo'}>
      {/* Corchete izquierdo */}
      <path d="M7 6 H4 V18 H7" />
      {/* Corchete derecho */}
      <path d="M17 6 H20 V18 H17" />
      {/* Puntitos en el medio (opcional, estilo REAPER) */}
      <line x1="10" y1="12" x2="14" y2="12" strokeDasharray="1 2" />
    </IconBase>
  );
}