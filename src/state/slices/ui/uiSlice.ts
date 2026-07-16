// src/state/slices/ui/uiSlice.ts

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export type ActivePanel =
  | 'timeline'
  | 'mixer'
  | 'piano-roll'
  | 'browser'
  | null;

export type SidebarSide = 'left' | 'right';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface UIState {
  // ─── Paneles principales ────────────────────────────────
  activePanel: ActivePanel;
  showMixer: boolean;
  showBrowser: boolean;
  showInspector: boolean;

  // ─── Overlays / modales ─────────────────────────────────
  showShortcutsOverlay: boolean;
  showDebug: boolean;
  /** ID del clip cuyo modal de propiedades está abierto (null = cerrado) */
  clipPropertiesModalId: string | null;
  /** ID de la track cuyo FX Browser está abierto (null = cerrado) */
  fxBrowserTrackId: string | null;

  /**
   * Set de trackIds cuya ventana FX Chain está abierta.
   * Permite múltiples ventanas simultáneas (una por track).
   * Almacenado como array para serialización JSON (Redux DevTools).
   */
  openFxChainWindows: string[];

  // ─── Preferences (ventana única) ────────────────────────
  /**
   * Si `true`, la ventana Preferences está abierta.
   * Solo hay una instancia (singleton).
   */
  showPreferences: boolean;
  /**
   * ID de la categoría seleccionada en el sidebar de Preferences.
   * Null hasta que se abra por primera vez (entonces se aplica default).
   */
  selectedPreferenceId: string | null;

  // ─── Timeline ───────────────────────────────────────────
  /** Ancho del header de track en px */
  trackHeaderWidth: number;
  /** Píxeles por segundo en el timeline */
  pixelsPerSecond: number;
  /** Scroll horizontal del timeline en px */
  timelineScrollX: number;
  /** Scroll vertical del timeline en px */
  timelineScrollY: number;

  // ─── Notificaciones ─────────────────────────────────────
  /** Mensaje de toast visible (null = sin toast) */
  toastMessage: string | null;
  toastType: ToastType;
}

// ═══════════════════════════════════════════════════════════════
// 🎯 CONSTANTES
// ═══════════════════════════════════════════════════════════════

const MIN_PIXELS_PER_SECOND = 10;
const MAX_PIXELS_PER_SECOND = 2000;
const DEFAULT_PIXELS_PER_SECOND = 100;

const MIN_TRACK_HEADER_WIDTH = 120;
const MAX_TRACK_HEADER_WIDTH = 400;
const DEFAULT_TRACK_HEADER_WIDTH = 200;

const MIN_SCROLL = 0;

const MIN_ZOOM_FACTOR = 0.01;
const MAX_ZOOM_FACTOR = 100;

// ═══════════════════════════════════════════════════════════════
// 🛠️ HELPERS
// ═══════════════════════════════════════════════════════════════

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function safeNumber(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

const createInitialState = (): UIState => ({
  activePanel: 'timeline',
  showMixer: true,
  showBrowser: false,
  showInspector: false,
  showShortcutsOverlay: false,
  showDebug: false,
  clipPropertiesModalId: null,
  fxBrowserTrackId: null,
  openFxChainWindows: [],
  showPreferences: false,
  selectedPreferenceId: null,
  trackHeaderWidth: DEFAULT_TRACK_HEADER_WIDTH,
  pixelsPerSecond: DEFAULT_PIXELS_PER_SECOND,
  timelineScrollX: 0,
  timelineScrollY: 0,
  toastMessage: null,
  toastType: 'info',
});

// ═══════════════════════════════════════════════════════════════
// 🏪 SLICE
// ═══════════════════════════════════════════════════════════════

const initialState: UIState = createInitialState();

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    // ─── PANELES PRINCIPALES ─────────────────────────────────

    setActivePanel(state, action: PayloadAction<ActivePanel>) {
      state.activePanel = action.payload;
    },

    toggleMixer(state) {
      state.showMixer = !state.showMixer;
    },

    setMixerVisible(state, action: PayloadAction<boolean>) {
      state.showMixer = action.payload;
    },

    toggleBrowser(state) {
      state.showBrowser = !state.showBrowser;
    },

    setBrowserVisible(state, action: PayloadAction<boolean>) {
      state.showBrowser = action.payload;
    },

    toggleInspector(state) {
      state.showInspector = !state.showInspector;
    },

    setInspectorVisible(state, action: PayloadAction<boolean>) {
      state.showInspector = action.payload;
    },

    // ─── OVERLAYS / MODALES ──────────────────────────────────

    toggleShortcutsOverlay(state) {
      state.showShortcutsOverlay = !state.showShortcutsOverlay;
    },

    setShortcutsOverlay(state, action: PayloadAction<boolean>) {
      state.showShortcutsOverlay = action.payload;
    },

    toggleDebug(state) {
      state.showDebug = !state.showDebug;
    },

    setDebugVisible(state, action: PayloadAction<boolean>) {
      state.showDebug = action.payload;
    },

    // ─── Modal de propiedades del clip ───────────────────────

    openClipProperties(state, action: PayloadAction<string>) {
      state.clipPropertiesModalId = action.payload;
    },

    closeClipProperties(state) {
      state.clipPropertiesModalId = null;
    },

    // ─── FX Browser Modal ────────────────────────────────────

    openFxBrowser(state, action: PayloadAction<string>) {
      state.fxBrowserTrackId = action.payload;
    },

    closeFxBrowser(state) {
      state.fxBrowserTrackId = null;
    },

    // ─── FX Chain Windows (flotantes, múltiples) ─────────────

    openFxChainWindow(state, action: PayloadAction<string>) {
      const trackId = action.payload;
      if (!state.openFxChainWindows.includes(trackId)) {
        state.openFxChainWindows.push(trackId);
      }
    },

    closeFxChainWindow(state, action: PayloadAction<string>) {
      state.openFxChainWindows = state.openFxChainWindows.filter(
        (id) => id !== action.payload
      );
    },

    toggleFxChainWindow(state, action: PayloadAction<string>) {
      const trackId = action.payload;
      const idx = state.openFxChainWindows.indexOf(trackId);
      if (idx === -1) {
        state.openFxChainWindows.push(trackId);
      } else {
        state.openFxChainWindows.splice(idx, 1);
      }
    },

    closeAllFxChainWindows(state) {
      state.openFxChainWindows = [];
    },

    // ─── Preferences Window (singleton) ──────────────────────

    /**
     * Abre la ventana Preferences.
     * Si es la primera vez, `selectedPreferenceId` sigue null
     * y el componente aplicará el default del catálogo.
     */
    openPreferences(state) {
      state.showPreferences = true;
    },

    closePreferences(state) {
      state.showPreferences = false;
    },

    /**
     * Abre si estaba cerrada, cierra si estaba abierta.
     * Usado por el botón ☰ del TopBar.
     */
    togglePreferences(state) {
      state.showPreferences = !state.showPreferences;
    },

    /**
     * Cambia la categoría seleccionada del sidebar.
     * Persiste entre aperturas de la ventana (mientras dure la sesión).
     */
    setSelectedPreference(state, action: PayloadAction<string>) {
      state.selectedPreferenceId = action.payload;
    },

    // ─── TIMELINE ───────────────────────────────────────────

    setPixelsPerSecond(state, action: PayloadAction<number>) {
      state.pixelsPerSecond = clamp(
        safeNumber(action.payload, DEFAULT_PIXELS_PER_SECOND),
        MIN_PIXELS_PER_SECOND,
        MAX_PIXELS_PER_SECOND
      );
    },

    nudgeZoom(state, action: PayloadAction<number>) {
      const factor = clamp(
        safeNumber(action.payload, 1),
        MIN_ZOOM_FACTOR,
        MAX_ZOOM_FACTOR
      );
      state.pixelsPerSecond = clamp(
        state.pixelsPerSecond * factor,
        MIN_PIXELS_PER_SECOND,
        MAX_PIXELS_PER_SECOND
      );
    },

    resetZoom(state) {
      state.pixelsPerSecond = DEFAULT_PIXELS_PER_SECOND;
    },

    setTrackHeaderWidth(state, action: PayloadAction<number>) {
      state.trackHeaderWidth = clamp(
        Math.round(safeNumber(action.payload, DEFAULT_TRACK_HEADER_WIDTH)),
        MIN_TRACK_HEADER_WIDTH,
        MAX_TRACK_HEADER_WIDTH
      );
    },

    setTimelineScrollX(state, action: PayloadAction<number>) {
      state.timelineScrollX = Math.max(
        MIN_SCROLL,
        safeNumber(action.payload, 0)
      );
    },

    setTimelineScrollY(state, action: PayloadAction<number>) {
      state.timelineScrollY = Math.max(
        MIN_SCROLL,
        safeNumber(action.payload, 0)
      );
    },

    setTimelineScroll(
      state,
      action: PayloadAction<{ x?: number; y?: number }>
    ) {
      const { x, y } = action.payload;
      if (x !== undefined) {
        state.timelineScrollX = Math.max(MIN_SCROLL, safeNumber(x, 0));
      }
      if (y !== undefined) {
        state.timelineScrollY = Math.max(MIN_SCROLL, safeNumber(y, 0));
      }
    },

    // ─── NOTIFICACIONES ──────────────────────────────────────

    showToast(
      state,
      action: PayloadAction<{ message: string; type?: ToastType }>
    ) {
      state.toastMessage = action.payload.message;
      state.toastType = action.payload.type ?? 'info';
    },

    clearToast(state) {
      state.toastMessage = null;
      state.toastType = 'info';
    },

    // ─── RESET ───────────────────────────────────────────────

    resetUI() {
      return createInitialState();
    },
  },
});

// ═══════════════════════════════════════════════════════════════
// 📤 EXPORTS: ACCIONES
// ═══════════════════════════════════════════════════════════════

export const {
  // Paneles principales
  setActivePanel,
  toggleMixer,
  setMixerVisible,
  toggleBrowser,
  setBrowserVisible,
  toggleInspector,
  setInspectorVisible,
  // Overlays / modales
  toggleShortcutsOverlay,
  setShortcutsOverlay,
  toggleDebug,
  setDebugVisible,
  // Clip properties
  openClipProperties,
  closeClipProperties,
  // FX Browser
  openFxBrowser,
  closeFxBrowser,
  // FX Chain Windows
  openFxChainWindow,
  closeFxChainWindow,
  toggleFxChainWindow,
  closeAllFxChainWindows,
  // Preferences Window
  openPreferences,
  closePreferences,
  togglePreferences,
  setSelectedPreference,
  // Timeline
  setPixelsPerSecond,
  nudgeZoom,
  resetZoom,
  setTrackHeaderWidth,
  setTimelineScrollX,
  setTimelineScrollY,
  setTimelineScroll,
  // Notificaciones
  showToast,
  clearToast,
  // Reset
  resetUI,
} = uiSlice.actions;

// ═══════════════════════════════════════════════════════════════
// 📤 EXPORTS: SELECTORES
// ═══════════════════════════════════════════════════════════════

type UIRootState = { ui: UIState };

export const selectUIState = (s: UIRootState): UIState => s.ui;
export const selectActivePanel = (s: UIRootState): ActivePanel => s.ui.activePanel;
export const selectShowMixer = (s: UIRootState): boolean => s.ui.showMixer;
export const selectShowBrowser = (s: UIRootState): boolean => s.ui.showBrowser;
export const selectShowInspector = (s: UIRootState): boolean => s.ui.showInspector;
export const selectShowShortcutsOverlay = (s: UIRootState): boolean => s.ui.showShortcutsOverlay;
export const selectShowDebug = (s: UIRootState): boolean => s.ui.showDebug;
export const selectClipPropertiesModalId = (s: UIRootState): string | null => s.ui.clipPropertiesModalId;
export const selectFxBrowserTrackId = (s: UIRootState): string | null => s.ui.fxBrowserTrackId;

/** Lista de trackIds con ventana FX Chain abierta */
export const selectOpenFxChainWindows = (s: UIRootState): string[] =>
  s.ui.openFxChainWindows;

/** true si la ventana FX Chain de esta track está abierta */
export const selectIsFxChainWindowOpen = (
  s: UIRootState,
  trackId: string
): boolean => s.ui.openFxChainWindows.includes(trackId);

/** true si la ventana Preferences está abierta */
export const selectShowPreferences = (s: UIRootState): boolean =>
  s.ui.showPreferences;

/**
 * ID de la categoría de preferences seleccionada.
 * `null` si el usuario nunca ha abierto la ventana.
 */
export const selectSelectedPreferenceId = (s: UIRootState): string | null =>
  s.ui.selectedPreferenceId;

export const selectPixelsPerSecond = (s: UIRootState): number => s.ui.pixelsPerSecond;
export const selectTrackHeaderWidth = (s: UIRootState): number => s.ui.trackHeaderWidth;
export const selectTimelineScrollX = (s: UIRootState): number => s.ui.timelineScrollX;
export const selectTimelineScrollY = (s: UIRootState): number => s.ui.timelineScrollY;
export const selectToastMessage = (s: UIRootState): string | null => s.ui.toastMessage;
export const selectToastType = (s: UIRootState): ToastType => s.ui.toastType;

/** @deprecated Prefiere selectToastMessage + selectToastType por separado. */
export const selectToast = (s: UIRootState) => ({
  message: s.ui.toastMessage,
  type: s.ui.toastType,
});

export default uiSlice.reducer;