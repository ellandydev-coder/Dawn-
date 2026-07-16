// src/state/hooks/useMixerChannels.ts
// ═══════════════════════════════════════════════════════════════
// 🎚️ useMixerChannels — Hook de operaciones bulk sobre múltiples canales
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@state/store';
import { toggleMute, toggleSolo } from '@state/slices/tracks/tracksSlice';

export interface MixerChannelsData {
  trackIds: string[];
  anyMuted: boolean;
  anySoloed: boolean;
  allMuted: boolean;
  bulkActions: {
    muteAll: () => void;
    unmuteAll: () => void;
    soloAll: () => void;
  };
}

export function useMixerChannels(trackIds: string[]): MixerChannelsData {
  const dispatch = useAppDispatch();

  const trackStates = useAppSelector((s) =>
    trackIds.map((id) => ({
      id,
      muted: s.tracks.byId[id]?.muted === true,
      soloed: s.tracks.byId[id]?.soloed === true,
    }))
  );

  const anyMuted = useMemo(
    () => trackStates.some((track) => track.muted),
    [trackStates]
  );

  const anySoloed = useMemo(
    () => trackStates.some((track) => track.soloed),
    [trackStates]
  );

  const allMuted = useMemo(
    () => trackStates.length > 0 && trackStates.every((track) => track.muted),
    [trackStates]
  );

  // ─── Ref para bulk actions (evita re-crear listeners) ───
  const trackStatesRef = useRef(trackStates);
  useEffect(() => { trackStatesRef.current = trackStates; }, [trackStates]);

  const bulkActions = useMemo(
    () => ({
      muteAll: () => {
        for (const track of trackStatesRef.current) {
          if (!track.muted) {
            dispatch(toggleMute(track.id));
          }
        }
      },
      unmuteAll: () => {
        for (const track of trackStatesRef.current) {
          if (track.muted) {
            dispatch(toggleMute(track.id));
          }
        }
      },
      soloAll: () => {
        for (const track of trackStatesRef.current) {
          if (!track.soloed) {
            dispatch(toggleSolo(track.id));
          }
        }
      },
    }),
    [dispatch]
  );

  return {
    trackIds,
    anyMuted,
    anySoloed,
    allMuted,
    bulkActions,
  };
}