import { IconBase } from '../IconBase';
import type { IconProps } from '../types';

export function RedoIcon(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? 'Rehacer'}>
      <path d="M21 7v6h-6" />
      <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6.71 3L21 13" />
    </IconBase>
  );
}