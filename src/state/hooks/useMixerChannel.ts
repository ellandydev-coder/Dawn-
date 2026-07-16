// src/state/hooks/useMixerChannel.ts
// ═══════════════════════════════════════════════════════════════
// 🎚️ useMixerChannel — Hook de canal individual de track
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@state/store';
import {
  setTrackVolume,
  setTrackPan,
  toggleMute,
  toggleSolo,
  toggleArm,
  selectTrack,
} from '@state/slices/tracks/tracksSlice';
import { deleteTrackCascade } from '@state/slices/tracks/tracksThunks';
import { commitGesture } from '@state/slices/history/historySlice';
import { formatDb, DEFAULT_VOLUME } from '@shared/utils/dBConversion';
import type { Track } from '@domain/models/Track';

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

export interface MixerChannelHandlers {
  onSelect: () => void;
  onRemove: () => Promise<void> | void;
  onVolumeChange: (v: number) => void;
  onVolumeCommit: (v: number) => void;
  onVolumeReset: () => void;
  onPanChange: (v: number) => void;
  onPanCommit: (v: number) => void;
  onPanReset: () => void;
  onToggleMute: () => void;
  onToggleSolo: () => void;
  onToggleArm: () => void;
}

export interface MixerChannelData {
  track: Track | null;
  isSelected: boolean;
  dbLabel: string;
  exists: boolean;
  handlers: MixerChannelHandlers;
}

export interface UseMixerChannelOptions {
  onBeforeDelete?: (trackId: string) => boolean | Promise<boolean>;
  onVolumeCommitted?: (trackId: string, value: number) => void;
  onPanCommitted?: (trackId: string, value: number) => void;
}

const DEFAULT_PAN = 0;

// ═══════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════

export function useMixerChannel(
  trackId: string,
  options: UseMixerChannelOptions = {}
): MixerChannelData {
  const { onBeforeDelete, onVolumeCommitted, onPanCommitted } = options;
  const dispatch = useAppDispatch();

  // Refs para callbacks externos (actualizadas en useEffect)
  const onBeforeDeleteRef = useRef(onBeforeDelete);
  const onVolumeCommittedRef = useRef(onVolumeCommitted);
  const onPanCommittedRef = useRef(onPanCommitted);

  useEffect(() => { onBeforeDeleteRef.current = onBeforeDelete; }, [onBeforeDelete]);
  useEffect(() => { onVolumeCommittedRef.current = onVolumeCommitted; }, [onVolumeCommitted]);
  useEffect(() => { onPanCommittedRef.current = onPanCommitted; }, [onPanCommitted]);

  // ═══════════════════════════════════
  // Selectores atómicos
  // ═══════════════════════════════════
  const name = useAppSelector((s) => s.tracks.byId[trackId]?.name);
  const color = useAppSelector((s) => s.tracks.byId[trackId]?.color);
  const volume = useAppSelector((s) => s.tracks.byId[trackId]?.volume);
  const pan = useAppSelector((s) => s.tracks.byId[trackId]?.pan);
  const muted = useAppSelector((s) => s.tracks.byId[trackId]?.muted);
  const soloed = useAppSelector((s) => s.tracks.byId[trackId]?.soloed);
  const armed = useAppSelector((s) => s.tracks.byId[trackId]?.armed);
  const type = useAppSelector((s) => s.tracks.byId[trackId]?.type);
  const height = useAppSelector((s) => s.tracks.byId[trackId]?.height);
  const clipIds = useAppSelector((s) => s.tracks.byId[trackId]?.clipIds);
  const effectChainId = useAppSelector(
    (s) => s.tracks.byId[trackId]?.effectChainId
  );
  const outputTrackId = useAppSelector(
    (s) => s.tracks.byId[trackId]?.outputTrackId
  );

  const isSelected = useAppSelector(
    (s) => s.tracks.selectedTrackId === trackId
  );

  const exists =
    name !== undefined &&
    color !== undefined &&
    volume !== undefined &&
    pan !== undefined &&
    muted !== undefined &&
    soloed !== undefined &&
    armed !== undefined &&
    type !== undefined &&
    height !== undefined &&
    clipIds !== undefined;

  // ═══════════════════════════════════
  // Track memoizado
  // ═══════════════════════════════════
  const track = useMemo<Track | null>(() => {
    if (!exists) return null;

    return {
      id: trackId,
      name,
      color,
      volume,
      pan,
      muted,
      soloed,
      armed,
      type,
      height,
      clipIds,
      effectChainId: effectChainId ?? null,
      outputTrackId: outputTrackId ?? null,
    };
  }, [
    exists,
    trackId,
    name,
    color,
    volume,
    pan,
    muted,
    soloed,
    armed,
    type,
    height,
    clipIds,
    effectChainId,
    outputTrackId,
  ]);

  const dbLabel = exists ? formatDb(volume) : '-∞';

  // ─── Ref para nombre (usado en labels de historial) ───
  const nameRef = useRef(name);
  useEffect(() => { nameRef.current = name; }, [name]);

  // ═══════════════════════════════════
  // Handlers estables
  // ═══════════════════════════════════

  const handleRemove = useCallback(async () => {
    const beforeDelete = onBeforeDeleteRef.current;
    if (beforeDelete) {
      const ok = await beforeDelete(trackId);
      if (!ok) return;
    }
    await dispatch(deleteTrackCascade(trackId));
  }, [dispatch, trackId]);

  const handleVolumeChange = useCallback(
    (v: number) => {
      dispatch(setTrackVolume({ id: trackId, volume: v }));
    },
    [dispatch, trackId]
  );

  const handleVolumeCommit = useCallback(
    (v: number) => {
      const trackName = nameRef.current ?? 'Track';
      dispatch(
        commitGesture({
          slice: 'tracks',
          entityId: trackId,
          field: 'volume',
          value: v,
          label: `${trackName}: cambiar volumen`,
        })
      );
      onVolumeCommittedRef.current?.(trackId, v);
    },
    [dispatch, trackId]
  );

  const handleVolumeReset = useCallback(() => {
    dispatch(setTrackVolume({ id: trackId, volume: DEFAULT_VOLUME }));
    const trackName = nameRef.current ?? 'Track';
    dispatch(
      commitGesture({
        slice: 'tracks',
        entityId: trackId,
        field: 'volume',
        value: DEFAULT_VOLUME,
        label: `${trackName}: reset volumen`,
      })
    );
    onVolumeCommittedRef.current?.(trackId, DEFAULT_VOLUME);
  }, [dispatch, trackId]);

  const handlePanChange = useCallback(
    (v: number) => {
      dispatch(setTrackPan({ id: trackId, pan: v }));
    },
    [dispatch, trackId]
  );

  const handlePanCommit = useCallback(
    (v: number) => {
      const trackName = nameRef.current ?? 'Track';
      dispatch(
        commitGesture({
          slice: 'tracks',
          entityId: trackId,
          field: 'pan',
          value: v,
          label: `${trackName}: cambiar pan`,
        })
      );
      onPanCommittedRef.current?.(trackId, v);
    },
    [dispatch, trackId]
  );

  const handlePanReset = useCallback(() => {
    dispatch(setTrackPan({ id: trackId, pan: DEFAULT_PAN }));
    const trackName = nameRef.current ?? 'Track';
    dispatch(
      commitGesture({
        slice: 'tracks',
        entityId: trackId,
        field: 'pan',
        value: DEFAULT_PAN,
        label: `${trackName}: reset pan`,
      })
    );
    onPanCommittedRef.current?.(trackId, DEFAULT_PAN);
  }, [dispatch, trackId]);

  const handleToggleMute = useCallback(() => {
    dispatch(toggleMute(trackId));
  }, [dispatch, trackId]);

  const handleToggleSolo = useCallback(() => {
    dispatch(toggleSolo(trackId));
  }, [dispatch, trackId]);

  const handleToggleArm = useCallback(() => {
    dispatch(toggleArm(trackId));
  }, [dispatch, trackId]);

  const handleSelect = useCallback(() => {
    dispatch(selectTrack(trackId));
  }, [dispatch, trackId]);

  const handlers = useMemo<MixerChannelHandlers>(
    () => ({
      onSelect: handleSelect,
      onRemove: handleRemove,
      onVolumeChange: handleVolumeChange,
      onVolumeCommit: handleVolumeCommit,
      onVolumeReset: handleVolumeReset,
      onPanChange: handlePanChange,
      onPanCommit: handlePanCommit,
      onPanReset: handlePanReset,
      onToggleMute: handleToggleMute,
      onToggleSolo: handleToggleSolo,
      onToggleArm: handleToggleArm,
    }),
    [
      handleSelect,
      handleRemove,
      handleVolumeChange,
      handleVolumeCommit,
      handleVolumeReset,
      handlePanChange,
      handlePanCommit,
      handlePanReset,
      handleToggleMute,
      handleToggleSolo,
      handleToggleArm,
    ]
  );

  return {
    track,
    isSelected,
    dbLabel,
    exists,
    handlers,
  };
}