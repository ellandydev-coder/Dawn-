/**
 * shortcutTypes.ts
 * ----------------
 * Tipos del sistema de atajos de teclado.
 */

/**
 * Contextos donde puede estar activo un atajo.
 * "global" = siempre activo (a menos que estés escribiendo en un input)
 */
export type ShortcutContext =
  | 'global'
  | 'timeline'
  | 'mixer'
  | 'piano-roll'
  | 'browser';

/**
 * Definición de un atajo individual.
 */
export interface ShortcutDefinition {
  /** Combinación de teclas normalizada, ej: "space", "ctrl+s", "shift+alt+m" */
  keys: string;
  /** Descripción legible (aparece en la modal F1) */
  description: string;
  /** Contexto donde funciona */
  context: ShortcutContext;
  /** Categoría para agrupar en la modal de ayuda */
  category: string;
  /** Función que se ejecuta */
  handler: (e: KeyboardEvent) => void;
  /** Si es true, permite disparar incluso dentro de inputs */
  allowInInputs?: boolean;
  /** Si es true, previene el default del navegador */
  preventDefault?: boolean;
}

/** Firma que devuelve el ShortcutManager al registrar */
export type UnregisterFn = () => void;

/** Mapa simple para uso con el hook: "Ctrl+S" -> handler */
export type ShortcutMap = Record<string, (e: KeyboardEvent) => void>;

/** Info para renderizar la cheatsheet */
export interface ShortcutInfo {
  keys: string;
  description: string;
  category: string;
  context: ShortcutContext;
}