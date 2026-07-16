import { IconBase } from '../IconBase';
import type { IconProps } from '../types';

export function LockIcon(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? 'Bloquear'}>
      <rect x="4" y="11" width="16" height="10" rx="1" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </IconBase>
  );
}