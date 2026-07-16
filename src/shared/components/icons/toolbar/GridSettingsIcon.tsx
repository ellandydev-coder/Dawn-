import { IconBase } from '../IconBase';
import type { IconProps } from '../types';

export function GridSettingsIcon(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? 'Configuración de grid'}>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="8" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
    </IconBase>
  );
}