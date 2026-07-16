import { IconBase } from '../IconBase';
import type { IconProps } from '../types';

export function RecordIcon(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? 'Record'}>
      {/* Anillo exterior */}
      <circle cx="12" cy="12" r="9" fill="none" />
      {/* Círculo interior relleno */}
      <circle cx="12" cy="12" r="5" fill="currentColor" stroke="none" />
    </IconBase>
  );
}