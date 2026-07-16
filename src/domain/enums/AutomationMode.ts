/**
 * AutomationMode
 * --------------
 * Modos de automatización estilo DAWs profesionales.
 */

export const AutomationMode = {
  OFF:   'off',
  READ:  'read',
  WRITE: 'write',
  TOUCH: 'touch',
  LATCH: 'latch',
} as const;

export type AutomationMode = typeof AutomationMode[keyof typeof AutomationMode];

export const ALL_AUTOMATION_MODES = Object.values(AutomationMode) as [string, ...string[]];

export const isAutomationMode = (value: unknown): value is AutomationMode =>
  typeof value === 'string' && ALL_AUTOMATION_MODES.includes(value);

export const AUTOMATION_MODE_LABELS: Record<AutomationMode, string> = {
  [AutomationMode.OFF]:   'Off',
  [AutomationMode.READ]:  'Read',
  [AutomationMode.WRITE]: 'Write',
  [AutomationMode.TOUCH]: 'Touch',
  [AutomationMode.LATCH]: 'Latch',
};

export const isWriteMode = (mode: AutomationMode): boolean =>
  mode === AutomationMode.WRITE ||
  mode === AutomationMode.TOUCH ||
  mode === AutomationMode.LATCH;

/** ¿Este modo lee automatización existente? */
export const isReadMode = (mode: AutomationMode): boolean =>
  mode === AutomationMode.READ ||
  mode === AutomationMode.TOUCH ||
  mode === AutomationMode.LATCH;