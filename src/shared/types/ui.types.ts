/**
 * ui.types.ts
 * -----------
 * Tipos específicos de la capa de UI (no del dominio).
 */

// ═══════════════════════════════════════════════════════════════
// 🎯 SELECCIÓN Y HERRAMIENTAS
// ═══════════════════════════════════════════════════════════════

/** Herramienta activa en el timeline */
export type Tool =
  | 'select'    // Flecha (selección/mover)
  | 'cut'       // Tijeras (cortar clips)
  | 'draw'      // Lápiz (dibujar automatización/notas)
  | 'erase'     // Borrador
  | 'zoom';     // Zoom

/** Modo de snap del timeline */
export type SnapMode =
  | 'off'
  | 'grid'
  | 'bar'
  | 'beat'
  | 'sixteenth'
  | 'clip'
  | 'marker';

/** División de grid visible */
export type GridDivision =
  | '1/1'
  | '1/2'
  | '1/4'
  | '1/8'
  | '1/16'
  | '1/32';

// ═══════════════════════════════════════════════════════════════
// 🎯 SELECCIÓN
// ═══════════════════════════════════════════════════════════════

export interface Selection {
  trackIds: readonly string[];
  clipIds: readonly string[];
  noteIds: readonly string[];
  timeRange?: {
    start: number;
    end: number;
  };
}

// ═══════════════════════════════════════════════════════════════
// 🎯 PANELES Y VISTAS
// ═══════════════════════════════════════════════════════════════

/** Vista activa principal */
export type MainView = 'arrangement' | 'mixer' | 'piano-roll';

/** Paneles opcionales */
export interface PanelVisibility {
  showMixer: boolean;
  showBrowser: boolean;
  showInspector: boolean;
  showAutomation: boolean;
  showDebug: boolean;
  showShortcutsOverlay: boolean;
}

// ═══════════════════════════════════════════════════════════════
// 🎯 ZOOM Y NAVEGACIÓN
// ═══════════════════════════════════════════════════════════════

export interface TimelineViewport {
  /** Píxeles por segundo (zoom horizontal) */
  pixelsPerSecond: number;
  /** Scroll horizontal en segundos */
  scrollSeconds: number;
  /** Scroll vertical en píxeles */
  scrollY: number;
  /** Altura por pista (px) */
  trackHeight: number;
}

// ═══════════════════════════════════════════════════════════════
// 🎯 THEMING
// ═══════════════════════════════════════════════════════════════

export type Theme = 'dark' | 'light' | 'auto';

export interface UIPreferences {
  theme: Theme;
  fontSize: 'small' | 'medium' | 'large';
  reducedMotion: boolean;
  colorblindMode?: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
}

// ═══════════════════════════════════════════════════════════════
// 🎯 DRAG & DROP
// ═══════════════════════════════════════════════════════════════

export interface DragState<T = unknown> {
  isDragging: boolean;
  type: string;
  data: T;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}