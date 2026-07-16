import { IconBase } from '../IconBase';
import type { IconProps } from '../types';

export function GridVisibilityIcon(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? 'Visibilidad de grid'}>
      {/* Contorno */}
      <rect x="3" y="3" width="18" height="18" rx="1" />
      {/* Verticales */}
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
      {/* Horizontales */}
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
    </IconBase>
  );
}