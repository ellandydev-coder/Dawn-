// src/state/slices/project/projectSlice.ts

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  type Project,
  createProject,
  touchProject,
} from '@domain/models/Project';
import type { TimeSignature } from '@domain/models/TimeSignature';

// ═══════════════════════════════════════════════════════════════
// 🎯 CONSTANTES
// ═══════════════════════════════════════════════════════════════

const MIN_BPM = 1;
const MAX_BPM = 999;
const MIN_DURATION = 0;
const MAX_ZOOM_LEVEL = 10;
const MIN_ZOOM_LEVEL = 0.1;
const VALID_SAMPLE_RATES = [22050, 44100, 48000, 88200, 96000, 192000] as const;
const VALID_TIME_DENOMINATORS = [2, 4, 8, 16] as const;
const MIN_TIME_NUMERATOR = 1;
const MAX_TIME_NUMERATOR = 16;

const DEFAULT_PROJECT_ID = 'default-project';
const DEFAULT_PROJECT_NAME = 'Untitled Project';

type ActiveView = 'arrangement' | 'mixer' | 'piano-roll';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface ProjectSliceState {
  current: Project;
  /** true mientras se está cargando un proyecto desde disco/red */
  isLoading: boolean;
  /** true si hay cambios sin guardar */
  isDirty: boolean;
  /** Ruta/URL del archivo del proyecto (null = nunca guardado) */
  filePath: string | null;
}

// ═══════════════════════════════════════════════════════════════
// 🛠️ HELPERS
// ═══════════════════════════════════════════════════════════════

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeProjectName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_PROJECT_NAME;
}

function isValidSampleRate(rate: number): boolean {
  return (VALID_SAMPLE_RATES as readonly number[]).includes(rate);
}

function isValidTimeDenominator(denom: number): boolean {
  return (VALID_TIME_DENOMINATORS as readonly number[]).includes(denom);
}

const createInitialState = (): ProjectSliceState => ({
  current: createProject({
    id: DEFAULT_PROJECT_ID,
    name: DEFAULT_PROJECT_NAME,
  }),
  isLoading: false,
  isDirty: false,
  filePath: null,
});

// ═══════════════════════════════════════════════════════════════
// 🏪 SLICE
// ═══════════════════════════════════════════════════════════════

const initialState: ProjectSliceState = createInitialState();

const projectSlice = createSlice({
  name: 'project',
  initialState,
  reducers: {
    // ─── METADATA ───────────────────────────────────────────

    renameProject(state, action: PayloadAction<string>) {
      const name = normalizeProjectName(action.payload);
      if (state.current.name === name) return;

      state.current = touchProject({ ...state.current, name });
      state.isDirty = true;
    },

    setProjectDescription(state, action: PayloadAction<string>) {
      const description = action.payload.trim() || undefined;
      if (state.current.description === description) return;

      state.current = touchProject({ ...state.current, description });
      state.isDirty = true;
    },

    setProjectAuthor(state, action: PayloadAction<string>) {
      const author = action.payload.trim() || undefined;
      if (state.current.author === author) return;

      state.current = touchProject({ ...state.current, author });
      state.isDirty = true;
    },

    setProjectNotes(state, action: PayloadAction<string>) {
      const notes = action.payload || undefined;
      if (state.current.notes === notes) return;

      state.current = touchProject({ ...state.current, notes });
      state.isDirty = true;
    },

    // ─── TAGS ───────────────────────────────────────────────

    addTag(state, action: PayloadAction<string>) {
      const tag = action.payload.trim();
      if (!tag || state.current.tags.includes(tag)) return;

      state.current = touchProject({
        ...state.current,
        tags: [...state.current.tags, tag],
      });
      state.isDirty = true;
    },

    removeTag(state, action: PayloadAction<string>) {
      const tag = action.payload.trim();
      if (!state.current.tags.includes(tag)) return;

      state.current = touchProject({
        ...state.current,
        tags: state.current.tags.filter((t) => t !== tag),
      });
      state.isDirty = true;
    },

    setTags(state, action: PayloadAction<string[]>) {
      const tags = [
        ...new Set(action.payload.map((t) => t.trim()).filter(Boolean)),
      ];
      state.current = touchProject({ ...state.current, tags });
      state.isDirty = true;
    },

    // ─── TEMPO / TIME ───────────────────────────────────────

    setBpm(state, action: PayloadAction<number>) {
      const bpm = clamp(action.payload, MIN_BPM, MAX_BPM);
      if (state.current.bpm === bpm) return;

      state.current = touchProject({ ...state.current, bpm });
      state.isDirty = true;
    },

    /**
     * Nudge BPM en un delta (p.ej. +1, −0.5).
     * Útil para tap-tempo o atajos de teclado.
     */
    nudgeBpm(state, action: PayloadAction<number>) {
      const bpm = clamp(state.current.bpm + action.payload, MIN_BPM, MAX_BPM);
      if (state.current.bpm === bpm) return;

      state.current = touchProject({ ...state.current, bpm });
      state.isDirty = true;
    },

    setTimeSignature(state, action: PayloadAction<TimeSignature>) {
      const { numerator, denominator } = action.payload;

      const safeNumerator = clamp(
        Math.round(numerator),
        MIN_TIME_NUMERATOR,
        MAX_TIME_NUMERATOR
      );

      const safeDenominator = isValidTimeDenominator(denominator)
        ? denominator
        : 4;

      const next: TimeSignature = {
        numerator: safeNumerator,
        denominator: safeDenominator,
      };

      if (
        state.current.timeSignature.numerator === next.numerator &&
        state.current.timeSignature.denominator === next.denominator
      ) {
        return;
      }

      state.current = touchProject({
        ...state.current,
        timeSignature: next,
      });
      state.isDirty = true;
    },

    // ─── AUDIO CONFIG ───────────────────────────────────────

    /**
     * Solo acepta valores estándar: 22050, 44100, 48000, 88200, 96000, 192000.
     * Ignorado con warning si el valor no es válido.
     */
    setSampleRate(state, action: PayloadAction<number>) {
      if (!isValidSampleRate(action.payload)) {
        console.warn(
          `[projectSlice] Sample rate inválida: ${action.payload}. ` +
            `Valores válidos: ${VALID_SAMPLE_RATES.join(', ')}`
        );
        return;
      }
      if (state.current.sampleRate === action.payload) return;

      state.current = touchProject({
        ...state.current,
        sampleRate: action.payload,
      });
      state.isDirty = true;
    },

    setDurationSeconds(state, action: PayloadAction<number>) {
      const duration = Math.max(MIN_DURATION, action.payload);
      if (state.current.durationSeconds === duration) return;

      state.current = touchProject({
        ...state.current,
        durationSeconds: duration,
      });
      state.isDirty = true;
    },

    // ─── UI STATE ───────────────────────────────────────────

    /**
     * activeView es UI state: no incrementa version ni modifiedAt.
     */
    setActiveView(state, action: PayloadAction<ActiveView>) {
      if (state.current.activeView === action.payload) return;

      state.current = {
        ...state.current,
        activeView: action.payload,
      };
    },

    /**
     * zoomLevel es UI state: no incrementa version ni modifiedAt.
     */
    setZoomLevel(state, action: PayloadAction<number>) {
      const zoom = clamp(action.payload, MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);
      if (state.current.zoomLevel === zoom) return;

      state.current = {
        ...state.current,
        zoomLevel: zoom,
      };
    },

    // ─── LAST OPENED ────────────────────────────────────────

    /**
     * Actualiza lastOpenedAt al timestamp actual.
     * Llamado al abrir un proyecto existente.
     */
    touchLastOpened(state) {
      state.current = {
        ...state.current,
        lastOpenedAt: Date.now(),
      };
    },

    // ─── PROYECTO / PERSISTENCIA ────────────────────────────

    /**
     * Carga un proyecto completo (abrir desde archivo).
     * Resetea isDirty y actualiza filePath.
     */
    loadProject(
      _state,
      action: PayloadAction<{
        project: Project;
        filePath?: string | null;
      }>
    ) {
      return {
        current: {
          ...action.payload.project,
          lastOpenedAt: Date.now(),
        },
        isLoading: false,
        isDirty: false,
        filePath: action.payload.filePath ?? null,
      };
    },

    setIsLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },

    /**
     * Marca el proyecto como guardado.
     * Llamado por ProjectManager después de guardar a disco.
     */
    markSaved(state, action: PayloadAction<{ filePath?: string }>) {
      state.isDirty = false;
      if (action.payload.filePath) {
        state.filePath = action.payload.filePath;
      }
    },

    setFilePath(state, action: PayloadAction<string | null>) {
      state.filePath = action.payload;
    },

    /**
     * Toca el proyecto (incrementa version/modifiedAt).
     * Para cambios que vienen de fuera del slice (auto-save, batch ops).
     */
    touch(state) {
      state.current = touchProject(state.current);
      state.isDirty = true;
    },

    /**
     * Nuevo proyecto: resetea todo al estado inicial.
     */
    resetProject() {
      return createInitialState();
    },
  },
});

// ═══════════════════════════════════════════════════════════════
// 📤 EXPORTS: ACCIONES
// ═══════════════════════════════════════════════════════════════

export const {
  // Metadata
  renameProject,
  setProjectDescription,
  setProjectAuthor,
  setProjectNotes,
  // Tags
  addTag,
  removeTag,
  setTags,
  // Tempo / time
  setBpm,
  nudgeBpm,
  setTimeSignature,
  // Audio config
  setSampleRate,
  setDurationSeconds,
  // UI state
  setActiveView,
  setZoomLevel,
  // Last opened
  touchLastOpened,
  // Proyecto / persistencia
  loadProject,
  setIsLoading,
  markSaved,
  setFilePath,
  touch,
  resetProject,
} = projectSlice.actions;

// ═══════════════════════════════════════════════════════════════
// 📤 EXPORTS: SELECTORES BÁSICOS
// ═══════════════════════════════════════════════════════════════

export const selectProjectSliceState = (
  state: { project: ProjectSliceState }
) => state.project;

export const selectCurrentProject = (
  state: { project: ProjectSliceState }
) => state.project.current;

export const selectIsProjectDirty = (
  state: { project: ProjectSliceState }
) => state.project.isDirty;

export const selectIsProjectLoading = (
  state: { project: ProjectSliceState }
) => state.project.isLoading;

export const selectProjectFilePath = (
  state: { project: ProjectSliceState }
) => state.project.filePath;

export default projectSlice.reducer;