/**
 * mixerSelectors.ts
 * -----------------
 * Selectores memoizados para el slice de mixer.
 *
 * Convenciones:
 * - Selectores base: O(1), acceso directo al state
 * - Selectores derivados: createSelector, memoizados
 * - Fábricas (makeSelect*): un selector por instancia de componente
 *
 * Nota: los selectores base del slice están en mixerSlice.ts.
 * Aquí van los selectores derivados y compuestos que no pertenecen al slice.
 */

import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@state/store';
import type { MixerChannel } from '@domain/models/MixerChannel';
import type { PanLaw } from '@domain/enums/PanLaw';

// ═══════════════════════════════════════════
// Selectores base (O(1), sin memoización)
// Re-exportados desde el slice para consumo centralizado.
// ═══════════════════════════════════════════

export const selectMixerState = (state: RootState) => state.mixer;
export const selectMixerGlobal = (state: RootState) => state.mixer.global;
export const selectMixerChannels = (state: RootState) => state.mixer.channels;
export const selectMixerCpuUsage = (state: RootState) => state.mixer.cpuUsage;

/** Acceso atómico a un canal por trackId */
export const selectMixerChannelByTrackId = (
  state: RootState,
  trackId: string
): MixerChannel | null => state.mixer.channels[trackId] ?? null;

// ═══════════════════════════════════════════
// Master — selectores atómicos
// Cada uno se suscribe solo a su campo.
// ═══════════════════════════════════════════

export const selectMasterVolume = createSelector(
  [selectMixerGlobal],
  (global): number => global.masterVolume
);

export const selectMasterMuted = createSelector(
  [selectMixerGlobal],
  (global): boolean => global.masterMuted
);

export const selectMasterLimiterEnabled = createSelector(
  [selectMixerGlobal],
  (global): boolean => global.masterLimiterEnabled
);

export const selectMasterHeadroom = createSelector(
  [selectMixerGlobal],
  (global): number => global.masterHeadroom
);

// ═══════════════════════════════════════════
// Mixer config — selectores atómicos
// ═══════════════════════════════════════════

export const selectMixerPanLaw = createSelector(
  [selectMixerGlobal],
  (global): PanLaw => global.panLaw as PanLaw
);
export const selectSoloIsExclusive = createSelector(
  [selectMixerGlobal],
  (global): boolean => global.soloIsExclusive
);

export const selectMixerChannelWidth = createSelector(
  [selectMixerGlobal],
  (global): number => global.channelWidth
);

export const selectShowSends = createSelector(
  [selectMixerGlobal],
  (global): boolean => global.showSends
);

export const selectShowInserts = createSelector(
  [selectMixerGlobal],
  (global): boolean => global.showInserts
);

// ═══════════════════════════════════════════
// Channels — selectores derivados
// ═══════════════════════════════════════════

/** Lista de todos los canales del mixer */
export const selectAllMixerChannels = createSelector(
  [selectMixerChannels],
  (channels): MixerChannel[] => Object.values(channels)
);

/** IDs de todos los canales (trackIds que tienen canal de mixer) */
export const selectMixerChannelIds = createSelector(
  [selectMixerChannels],
  (channels): string[] => Object.keys(channels)
);

/** Cantidad de canales */
export const selectMixerChannelCount = createSelector(
  [selectMixerChannels],
  (channels): number => Object.keys(channels).length
);

/** true si existe un canal para un trackId dado */
export const selectHasMixerChannel = (
  state: RootState,
  trackId: string
): boolean => trackId in state.mixer.channels;

// ═══════════════════════════════════════════
// Channel — propiedades específicas
// ═══════════════════════════════════════════

/** Insert IDs de un canal específico */
export const selectChannelInsertIds = createSelector(
  [selectMixerChannels, (_: RootState, trackId: string) => trackId],
  (channels, trackId): string[] => channels[trackId]?.insertIds ?? []
);

/** Send IDs de un canal específico */
export const selectChannelSendIds = createSelector(
  [selectMixerChannels, (_: RootState, trackId: string) => trackId],
  (channels, trackId): string[] => channels[trackId]?.sendIds ?? []
);

/** Output bus de un canal específico */
export const selectChannelOutputBusId = createSelector(
  [selectMixerChannels, (_: RootState, trackId: string) => trackId],
  (channels, trackId): string => channels[trackId]?.outputBusId ?? 'master'
);

/** true si los inserts del canal están bypaseados */
export const selectChannelInsertsBypassed = createSelector(
  [selectMixerChannels, (_: RootState, trackId: string) => trackId],
  (channels, trackId): boolean => channels[trackId]?.insertsBypassed ?? false
);

/** true si el canal muestra la lane de automation */
export const selectChannelShowAutomation = createSelector(
  [selectMixerChannels, (_: RootState, trackId: string) => trackId],
  (channels, trackId): boolean => channels[trackId]?.showAutomation ?? false
);

/** true si el metering del canal es pre-fader */
export const selectChannelMeterPreFader = createSelector(
  [selectMixerChannels, (_: RootState, trackId: string) => trackId],
  (channels, trackId): boolean => channels[trackId]?.meterPreFader ?? false
);

/** Segundos de peak hold del canal */
export const selectChannelPeakHoldSeconds = createSelector(
  [selectMixerChannels, (_: RootState, trackId: string) => trackId],
  (channels, trackId): number => channels[trackId]?.peakHoldSeconds ?? 2
);

// ═══════════════════════════════════════════
// Channels — queries agregadas
// ═══════════════════════════════════════════

/** Canales que tienen al menos un insert */
export const selectChannelsWithInserts = createSelector(
  [selectAllMixerChannels],
  (channels): MixerChannel[] =>
    channels.filter((ch) => ch.insertIds.length > 0)
);

/** Canales que tienen al menos un send */
export const selectChannelsWithSends = createSelector(
  [selectAllMixerChannels],
  (channels): MixerChannel[] =>
    channels.filter((ch) => ch.sendIds.length > 0)
);

/** Canales con automation visible */
export const selectChannelsWithAutomationVisible = createSelector(
  [selectAllMixerChannels],
  (channels): MixerChannel[] =>
    channels.filter((ch) => ch.showAutomation)
);

/** Canales que routean a un bus específico */
export const selectChannelsByOutputBus = createSelector(
  [selectAllMixerChannels, (_: RootState, busId: string) => busId],
  (channels, busId): MixerChannel[] =>
    channels.filter((ch) => ch.outputBusId === busId)
);

// ═══════════════════════════════════════════
// CPU usage
// ═══════════════════════════════════════════

/** CPU como porcentaje 0-100 (redondeado) */
export const selectCpuUsagePercent = createSelector(
  [selectMixerCpuUsage],
  (cpu): number => Math.round(cpu * 100)
);

/** true si la CPU está por encima del umbral de warning (70%) */
export const selectCpuWarning = createSelector(
  [selectMixerCpuUsage],
  (cpu): boolean => cpu > 0.7
);

/** true si la CPU está crítica (90%+) */
export const selectCpuCritical = createSelector(
  [selectMixerCpuUsage],
  (cpu): boolean => cpu > 0.9
);

// ═══════════════════════════════════════════
// Fábricas de selectores (por instancia)
// ═══════════════════════════════════════════

/**
 * Crea un selector memoizado para un canal específico.
 *
 * @example
 * const selectChannel = useMemo(() => makeSelectMixerChannelByTrackId(trackId), [trackId]);
 * const channel = useAppSelector(selectChannel);
 */
export const makeSelectMixerChannelByTrackId = (trackId: string) =>
  createSelector(
    [selectMixerChannels],
    (channels): MixerChannel | null => channels[trackId] ?? null
  );

/**
 * Crea un selector para los insert IDs de un canal.
 *
 * @example
 * const selectInserts = useMemo(() => makeSelectChannelInsertIds(trackId), [trackId]);
 * const insertIds = useAppSelector(selectInserts);
 */
export const makeSelectChannelInsertIds = (trackId: string) =>
  createSelector(
    [selectMixerChannels],
    (channels): string[] => channels[trackId]?.insertIds ?? []
  );

/**
 * Crea un selector para los send IDs de un canal.
 */
export const makeSelectChannelSendIds = (trackId: string) =>
  createSelector(
    [selectMixerChannels],
    (channels): string[] => channels[trackId]?.sendIds ?? []
  );