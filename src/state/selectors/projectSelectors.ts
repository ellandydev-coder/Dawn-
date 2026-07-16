/**
 * projectSelectors.ts
 * -------------------
 * Selectores memoizados para el estado del proyecto.
 *
 * Convenciones:
 * - Selectores base: O(1), sin memoización
 * - Selectores derivados: createSelector, memoizados
 * - Campos de Project se exponen individualmente para suscripciones atómicas
 */

import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@state/store';
import type { Project } from '@domain/models/Project';
import type { TimeSignature } from '@domain/models/TimeSignature';

// ═══════════════════════════════════════════
// Tipos
// ═══════════════════════════════════════════

export type ActiveView = 'arrangement' | 'mixer' | 'piano-roll';

// ═══════════════════════════════════════════
// Selectores base (O(1), sin memoización)
// ═══════════════════════════════════════════

export const selectProjectState = (state: RootState) => state.project;
export const selectCurrentProject = (state: RootState): Project =>
  state.project.current;

/** true si hay cambios sin guardar */
export const selectIsProjectDirty = (state: RootState): boolean =>
  state.project.isDirty;

/** true mientras se carga un proyecto */
export const selectIsProjectLoading = (state: RootState): boolean =>
  state.project.isLoading;

/** Ruta/URL del archivo del proyecto (null = nunca guardado) */
export const selectProjectFilePath = (state: RootState): string | null =>
  state.project.filePath;

// ═══════════════════════════════════════════
// Metadata del proyecto
// ═══════════════════════════════════════════

export const selectProjectId = createSelector(
  [selectCurrentProject],
  (project): string => project.id
);

export const selectProjectName = createSelector(
  [selectCurrentProject],
  (project): string => project.name
);

export const selectProjectAuthor = createSelector(
  [selectCurrentProject],
  (project): string | undefined => project.author
);

export const selectProjectDescription = createSelector(
  [selectCurrentProject],
  (project): string | undefined => project.description
);

export const selectProjectNotes = createSelector(
  [selectCurrentProject],
  (project): string | undefined => project.notes
);

export const selectProjectTags = createSelector(
  [selectCurrentProject],
  (project): string[] => project.tags
);

export const selectProjectContributors = createSelector(
  [selectCurrentProject],
  (project): string[] => project.contributors
);

// ═══════════════════════════════════════════
// Tempo / Time
// ═══════════════════════════════════════════

export const selectProjectBpm = createSelector(
  [selectCurrentProject],
  (project): number => project.bpm
);

export const selectProjectTimeSignature = createSelector(
  [selectCurrentProject],
  (project): TimeSignature => project.timeSignature
);

export const selectProjectSampleRate = createSelector(
  [selectCurrentProject],
  (project): number => project.sampleRate
);

export const selectProjectDurationSeconds = createSelector(
  [selectCurrentProject],
  (project): number => project.durationSeconds
);

// ═══════════════════════════════════════════
// Versión / timestamps
// ═══════════════════════════════════════════

export const selectProjectVersion = createSelector(
  [selectCurrentProject],
  (project): number => project.version
);

export const selectProjectFormatVersion = createSelector(
  [selectCurrentProject],
  (project): string => project.formatVersion
);

export const selectProjectCreatedAt = createSelector(
  [selectCurrentProject],
  (project): number => project.createdAt
);

export const selectProjectModifiedAt = createSelector(
  [selectCurrentProject],
  (project): number => project.modifiedAt
);

export const selectProjectLastOpenedAt = createSelector(
  [selectCurrentProject],
  (project): number | undefined => project.lastOpenedAt
);

// ═══════════════════════════════════════════
// UI state del proyecto
// ═══════════════════════════════════════════

export const selectProjectActiveView = createSelector(
  [selectCurrentProject],
  (project): ActiveView | undefined => project.activeView
);

export const selectProjectZoomLevel = createSelector(
  [selectCurrentProject],
  (project): number | undefined => project.zoomLevel
);

// ═══════════════════════════════════════════
// Selectores derivados compuestos
// ═══════════════════════════════════════════

/** true si el proyecto tiene tags */
export const selectProjectHasTags = createSelector(
  [selectProjectTags],
  (tags): boolean => tags.length > 0
);

/** true si el proyecto nunca se ha guardado a disco */
export const selectIsNewProject = createSelector(
  [selectProjectFilePath],
  (filePath): boolean => filePath === null
);

/** true si el proyecto tiene un autor asignado */
export const selectProjectHasAuthor = createSelector(
  [selectProjectAuthor],
  (author): boolean => author !== undefined && author.length > 0
);

/**
 * Título para la barra de título / tab del navegador.
 * Formato: "ProjectName • modified" o "ProjectName"
 */
export const selectProjectTitle = createSelector(
  [selectProjectName, selectIsProjectDirty],
  (name, isDirty): string => (isDirty ? `${name} •` : name)
);

/**
 * Resumen compacto del proyecto para tooltips / status bar.
 * Ej: "120 BPM · 4/4 · 48000 Hz"
 */
export const selectProjectSummary = createSelector(
  [selectProjectBpm, selectProjectTimeSignature, selectProjectSampleRate],
  (bpm, ts, sampleRate): string =>
    `${bpm} BPM · ${ts.numerator}/${ts.denominator} · ${sampleRate} Hz`
);