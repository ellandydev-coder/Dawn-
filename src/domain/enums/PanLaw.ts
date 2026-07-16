/**
 * PanLaw
 * ------
 * Curvas de compensación de paneo.
 *
 * - LINEAR:      Sin compensación (cae 6dB al centro)
 * - MINUS_3DB:   -3dB al centro (constante de potencia) - Estándar Reaper
 * - MINUS_45DB:  -4.5dB al centro (compromiso) - Estándar Pro Tools
 * - MINUS_6DB:   -6dB al centro (constante de voltaje) - Estándar Logic
 */

export const PanLaw = {
  LINEAR:     'linear',
  MINUS_3DB:  '-3dB',
  MINUS_45DB: '-4.5dB',
  MINUS_6DB:  '-6dB',
} as const;

export type PanLaw = typeof PanLaw[keyof typeof PanLaw];

export const ALL_PAN_LAWS = Object.values(PanLaw) as [string, ...string[]];

export const isPanLaw = (value: unknown): value is PanLaw =>
  typeof value === 'string' && ALL_PAN_LAWS.includes(value);

/** Compensación en dB al centro para cada ley */
export const PAN_LAW_CENTER_DB: Record<PanLaw, number> = {
  [PanLaw.LINEAR]:     0,
  [PanLaw.MINUS_3DB]:  -3,
  [PanLaw.MINUS_45DB]: -4.5,
  [PanLaw.MINUS_6DB]:  -6,
};

/** Labels legibles para UI */
export const PAN_LAW_LABELS: Record<PanLaw, string> = {
  [PanLaw.LINEAR]:     'Linear (0dB)',
  [PanLaw.MINUS_3DB]:  '-3dB (Equal Power)',
  [PanLaw.MINUS_45DB]: '-4.5dB (Pro Tools)',
  [PanLaw.MINUS_6DB]:  '-6dB (Equal Amplitude)',
};

/** Ley por defecto */
export const DEFAULT_PAN_LAW: PanLaw = PanLaw.MINUS_3DB;

/** Factor de ganancia al centro para cada ley */
export const panLawCenterGain = (law: PanLaw): number =>
  Math.pow(10, PAN_LAW_CENTER_DB[law] / 20);