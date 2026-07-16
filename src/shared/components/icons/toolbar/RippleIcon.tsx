import { IconBase } from '../IconBase';
import type { IconProps } from '../types';

export function RippleIcon(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? 'Ripple editing'}>
      {/* Primera S */}
      <path d="M4 8 Q 8 8, 8 12 T 12 16" />
      {/* Segunda S */}
      <path d="M12 8 Q 16 8, 16 12 T 20 16" />
    </IconBase>
  );
}