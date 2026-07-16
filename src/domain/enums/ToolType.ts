/**
 * ToolType
 * --------
 * Herramientas del cursor del timeline.
 */

export const ToolType = {
  SELECT: 'select',
  CUT:    'cut',
  DRAW:   'draw',
  ERASE:  'erase',
  ZOOM:   'zoom',
  HAND:   'hand',
} as const;

export type ToolType = typeof ToolType[keyof typeof ToolType];

export const ALL_TOOL_TYPES = Object.values(ToolType) as [string, ...string[]];

export const isToolType = (value: unknown): value is ToolType =>
  typeof value === 'string' && ALL_TOOL_TYPES.includes(value);

export const DEFAULT_TOOL: ToolType = ToolType.SELECT;

export const TOOL_SHORTCUTS: Record<ToolType, string> = {
  [ToolType.SELECT]: 's',
  [ToolType.CUT]:    't',
  [ToolType.DRAW]:   'p',
  [ToolType.ERASE]:  'e',
  [ToolType.ZOOM]:   'z',
  [ToolType.HAND]:   'h',
};

export const TOOL_ICONS: Record<ToolType, string> = {
  [ToolType.SELECT]: 'cursor',
  [ToolType.CUT]:    'scissors',
  [ToolType.DRAW]:   'pencil',
  [ToolType.ERASE]:  'eraser',
  [ToolType.ZOOM]:   'zoom-in',
  [ToolType.HAND]:   'hand',
};

export const TOOL_LABELS: Record<ToolType, string> = {
  [ToolType.SELECT]: 'Select',
  [ToolType.CUT]:    'Cut',
  [ToolType.DRAW]:   'Draw',
  [ToolType.ERASE]:  'Erase',
  [ToolType.ZOOM]:   'Zoom',
  [ToolType.HAND]:   'Hand',
};