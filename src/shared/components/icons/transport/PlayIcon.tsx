import { IconBase } from '../IconBase';
import type { IconProps } from '../types';

export function PlayIcon(props: IconProps) {
  return (
    <IconBase
      {...props}
      filled
      strokeLinejoin="round"
      title={props.title ?? 'Play'}
    >
      <path d="M7 4.5 L19 12 L7 19.5 Z" />
    </IconBase>
  );
}