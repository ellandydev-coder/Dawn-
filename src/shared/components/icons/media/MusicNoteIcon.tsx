import { IconBase } from '../IconBase';
import type { IconProps } from '../types';

export function MusicNoteIcon(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? 'Music'}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" fill="currentColor" />
      <circle cx="18" cy="16" r="3" fill="currentColor" />
    </IconBase>
  );
}