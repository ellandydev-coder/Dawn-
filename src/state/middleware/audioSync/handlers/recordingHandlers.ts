// src/state/middleware/audioSync/handlers/recordingHandlers.ts
//
// Escucha toggleRecord y coordina:
//   • Permiso de mic
//   • Count-in (si está activo y transport parado)
//   • Arm + start del MicRecorder
//   • Al detener: build take → AssetRegistry → addAsset → addClip
//
// También escucha setSelectedDevice para abrir el mic inmediatamente
// (estilo FL Studio) → el SO marca "micrófono en uso" al seleccionar.
//
// Si el usuario ya dejó un dispositivo "abierto" por selección, al terminar
// una grabación reabrimos ese stream de preview para que el indicador del SO
// permanezca encendido de forma REAL.
//
// El metrónomo del count-in usa MetronomeEngine.startPreCount(...)
// y sonará AUNQUE metronomeEnabled === false (comportamiento REAPER).

import {
  toggleRecord,
  startCountIn,
  finishCountIn,
  cancelCountIn,
} from '@state/slices/transport/transportSlice';
import { addClip } from '@state/slices/clips/clipsSlice';
import { addClipIdToTrack } from '@state/slices/tracks/tracksSlice';
import { addAsset } from '@state/slices/assets/assetsSlice';
import {
  setPermissionStatus,
  setAvailableDevices,
  setSelectedDevice,
} from '@state/slices/recording/recordingSlice';

import { audioEngine } from '@audio/engine/AudioEngine';
import { metronome } from '@audio/metronome/MetronomeSingleton';
import {
  requestMicPermission,
  stopStream,
} from '@audio/recording/utils/requestMicPermission';
import { getInputDevices } from '@audio/recording/utils/getInputDevices';

import { AssetRegistry } from '@services/assets/AssetRegistry';

import type { Asset } from '@domain/models/Asset';
import type { AppStartListening } from '../types';

// ─── Estado local del handler (no serializable) ───────────────────────────────

let _activeStream: MediaStream | null = null;
let _activeSourceNode: MediaStreamAudioSourceNode | null = null;

/** Stream abierto al seleccionar dispositivo (preview real). */
let _devicePreviewStream: MediaStream | null = null;

/**
 * Si el usuario seleccionó un dispositivo y queremos mantener el mic "vivo"
 * al estilo FL Studio, esta bandera nos dice que debemos reabrir el preview
 * después de detener o cancelar una grabación.
 */
let _keepPreviewAlive = false;

/** Si tuvimos que forzar el metrónomo temporalmente para el count-in,
 *  guardamos el estado previo para restaurarlo al terminar. */
let _metronomeWasForced = false;

type PreviewListenerApi = {
  dispatch: (action: unknown) => void;
  getState: () => {
    recording: {
      selectedDeviceId: string | null;
    };
    transport: {
      isRecording: boolean;
      isCountingIn: boolean;
    };
  };
};

function _cleanupStream(): void {
  if (_activeStream) {
    stopStream(_activeStream);
    _activeStream = null;
  }
  if (_activeSourceNode) {
    try { _activeSourceNode.disconnect(); } catch { /* ignore */ }
    _activeSourceNode = null;
  }
}

function _cleanupPreviewStream(): void {
  if (_devicePreviewStream) {
    stopStream(_devicePreviewStream);
    _devicePreviewStream = null;
  }
}

function _refreshDevices(listenerApi: { dispatch: (action: unknown) => void }): void {
  getInputDevices()
    .then((devices) => listenerApi.dispatch(setAvailableDevices(devices)))
    .catch(() => { /* no crítico */ });
}

/** Detiene el metrónomo si lo forzamos nosotros para el count-in. */
function _stopForcedMetronome(): void {
  if (!_metronomeWasForced) return;
  const metro = metronome.peek();
  metro?.stop();
  _metronomeWasForced = false;
}

async function _openPreviewStream(
  listenerApi: PreviewListenerApi,
  deviceId: string | undefined
): Promise<boolean> {
  _cleanupPreviewStream();

  listenerApi.dispatch(setPermissionStatus('pending'));

  const permResult = await requestMicPermission(deviceId);

  if (permResult.status !== 'granted' || !permResult.stream) {
    const nextStatus =
      permResult.status === 'unavailable' ? 'unavailable' : 'denied';
    listenerApi.dispatch(setPermissionStatus(nextStatus));
    console.warn(
      `[recordingHandlers] Mic no disponible al abrir preview: ${permResult.status}`
    );
    return false;
  }

  listenerApi.dispatch(setPermissionStatus('granted'));
  _devicePreviewStream = permResult.stream;
  _refreshDevices(listenerApi);

  return true;
}

async function _restorePreviewStreamIfNeeded(
  listenerApi: PreviewListenerApi
): Promise<void> {
  if (!_keepPreviewAlive) return;
  if (_devicePreviewStream || _activeStream) return;

  const state = listenerApi.getState();
  if (state.transport.isRecording || state.transport.isCountingIn) return;

  const deviceId = state.recording.selectedDeviceId ?? undefined;

  try {
    const reopened = await _openPreviewStream(listenerApi, deviceId);
    if (reopened) {
      console.info(
        `[recordingHandlers] Preview restaurado tras detener/cancelar: ${deviceId ?? 'default'}`
      );
    }
  } catch (err) {
    console.error('[recordingHandlers] Error al restaurar preview del micrófono:', err);
    listenerApi.dispatch(setPermissionStatus('error'));
  }
}

// ─── Handler principal ────────────────────────────────────────────────────────

export function registerRecordingHandlers(
  startListening: AppStartListening
): void {
  // ═══════════════════════════════════════════════════════════════
  // LISTENER 1: Selección de dispositivo → abrir mic inmediatamente
  // ═══════════════════════════════════════════════════════════════
  startListening({
    actionCreator: setSelectedDevice,
    effect: async (action, listenerApi) => {
      _keepPreviewAlive = true;

      const state = listenerApi.getState();
      if (state.transport.isRecording || state.transport.isCountingIn) {
        console.info(
          '[recordingHandlers] Cambio de dispositivo durante grabación/count-in; preview diferido hasta detener.'
        );
        return;
      }

      const deviceId = action.payload ?? undefined;

      try {
        const opened = await _openPreviewStream(listenerApi, deviceId);
        if (!opened) return;

        console.info(
          `[recordingHandlers] Dispositivo seleccionado y mic abierto: ${deviceId ?? 'default'}`
        );
      } catch (err) {
        console.error('[recordingHandlers] Error al abrir mic en selección:', err);
        listenerApi.dispatch(setPermissionStatus('error'));
      }
    },
  });

  // ═══════════════════════════════════════════════════════════════
  // LISTENER 2: toggleRecord → grabar / detener
  // ═══════════════════════════════════════════════════════════════
  startListening({
    actionCreator: toggleRecord,
    effect: async (_action, listenerApi) => {
      try {
        const state = listenerApi.getState();
        const { isRecording, isCountingIn, isPlaying } = state.transport;

        // ═════════════════════════════════════════════════════════════════
        // CASO 1: EMPEZAR (isRecording pasó a true)
        // ═════════════════════════════════════════════════════════════════
        if (isRecording) {
          const armedTrackIds = state.tracks.allIds.filter(
            (id) => state.tracks.byId[id]?.armed === true
          );

          if (armedTrackIds.length === 0) {
            console.warn('[recordingHandlers] Sin tracks armadas, noop');
            return;
          }

          // 1. Permiso mic
          // Si ya hay un preview stream abierto, lo reutilizamos.
          // Si no, pedimos permiso de cero.
          listenerApi.dispatch(setPermissionStatus('pending'));

          const deviceId = state.recording.selectedDeviceId ?? undefined;

          let stream: MediaStream;

          if (_devicePreviewStream) {
            stream = _devicePreviewStream;
            _devicePreviewStream = null; // transferimos ownership a la grabación
          } else {
            const permResult = await requestMicPermission(deviceId);

            if (permResult.status !== 'granted' || !permResult.stream) {
              const nextStatus =
                permResult.status === 'unavailable' ? 'unavailable' : 'denied';
              listenerApi.dispatch(setPermissionStatus(nextStatus));
              console.warn(`[recordingHandlers] Mic no disponible: ${permResult.status}`);
              return;
            }

            stream = permResult.stream;
          }

          listenerApi.dispatch(setPermissionStatus('granted'));
          _activeStream = stream;
          _refreshDevices(listenerApi);

          // 2. Source node + arm mic (aún NO empieza a grabar)
          const ctx = audioEngine.context;
          _activeSourceNode = ctx.createMediaStreamSource(_activeStream);

          const micRecorder = await audioEngine.getMicRecorder();
          micRecorder.arm(_activeSourceNode);

          // 3. Decidir: count-in o inmediato
          const shouldCountIn =
            state.transport.countInEnabled &&
            state.transport.countInBars > 0 &&
            !isPlaying; // count-in solo si estaba parado

          if (shouldCountIn) {
            await _startWithCountIn(listenerApi, micRecorder, state, armedTrackIds);
          } else {
            _startImmediate(listenerApi, micRecorder, armedTrackIds);
          }

        // ═════════════════════════════════════════════════════════════════
        // CASO 2: DETENER (isRecording pasó a false)
        // ═════════════════════════════════════════════════════════════════
        } else {
          // Si estábamos en count-in → cancelar sin grabar nada
          if (isCountingIn) {
            listenerApi.dispatch(cancelCountIn());
            _stopForcedMetronome();
            _cleanupStream();
            await _restorePreviewStreamIfNeeded(listenerApi);
            console.info('[recordingHandlers] Count-in cancelado');
            return;
          }

          // Grabación normal
          const micRecorder = audioEngine.getMicRecorderSync();

          if (!micRecorder || !micRecorder.isRecording()) {
            _cleanupStream();
            await _restorePreviewStreamIfNeeded(listenerApi);
            return;
          }

          try {
            const result = await micRecorder.stopRecording();
            AssetRegistry.register(result.id, result.buffer);

            const assetMeta: Asset = {
              id: result.id,
              name: `Take ${new Date().toLocaleTimeString()}`,
              duration: result.durationSec,
              sampleRate: result.sampleRate,
              numberOfChannels: result.channelCount,
              source: 'recording',
              createdAt: Date.now(),
            };
            listenerApi.dispatch(addAsset(assetMeta));

            const stateNow = listenerApi.getState();
            const armedTrackIds = stateNow.tracks.allIds.filter(
              (id) => stateNow.tracks.byId[id]?.armed === true
            );
            const startTime = stateNow.transport.editCursorSeconds;

            for (const trackId of armedTrackIds) {
              const clipAction = addClip({
                trackId,
                type: 'audio',
                name: assetMeta.name,
                startTime,
                duration: result.durationSec,
                assetId: result.id,
              });
              listenerApi.dispatch(clipAction);
              listenerApi.dispatch(
                addClipIdToTrack({
                  trackId,
                  clipId: clipAction.payload.id,
                })
              );
            }

            console.info(
              `[recordingHandlers] Take: ${result.id} (${result.durationSec.toFixed(2)}s) → ${armedTrackIds.length} clip(s)`
            );
          } catch (err) {
            console.error('[recordingHandlers] Error al detener grabación:', err);
          } finally {
            _cleanupStream();
            await _restorePreviewStreamIfNeeded(listenerApi);
          }
        }
      } catch (err) {
        console.error('[recordingHandlers] Error inesperado:', err);
        _cleanupStream();
        _stopForcedMetronome();
        await _restorePreviewStreamIfNeeded(listenerApi);
      }
    },
  });
}

// ─── Sub-flows ────────────────────────────────────────────────────────────────

/** Arranca grabación inmediata: dispatch play + start mic. */
function _startImmediate(
  listenerApi: {
    dispatch: (action: unknown) => void;
    getState: () => { transport: { editCursorSeconds: number } };
  },
  micRecorder: { startRecording: () => void },
  armedTrackIds: string[]
): void {
  // Simulamos el auto-play que antes hacía el reducer.
  // Usamos finishCountIn porque hace exactamente "isPlaying: true + playhead = editCursor".
  listenerApi.dispatch(finishCountIn());
  micRecorder.startRecording();

  console.info(
    `[recordingHandlers] Grabando en ${armedTrackIds.length} track(s): ${armedTrackIds.join(', ')}`
  );
}

/** Arranca count-in: dispatch startCountIn + startPreCount del metrónomo. */
async function _startWithCountIn(
  listenerApi: {
    dispatch: (action: unknown) => void;
    getState: () => {
      transport: {
        countInBars: number;
        metronomeEnabled: boolean;
        editCursorSeconds: number;
      };
      project: {
        current: {
          bpm: number;
          timeSignature: { numerator: number; denominator: number };
        };
      };
    };
  },
  micRecorder: { startRecording: () => void },
  state: ReturnType<typeof listenerApi.getState>,
  armedTrackIds: string[]
): Promise<void> {
  const metro = metronome.get();
  if (!metro) {
    console.warn('[recordingHandlers] Metronome no disponible, grabando inmediato');
    _startImmediate(listenerApi, micRecorder, armedTrackIds);
    return;
  }

  const { bpm, timeSignature } = state.project.current;
  const beatsPerBar = timeSignature.numerator;
  const totalBeats = state.transport.countInBars * beatsPerBar;

  // Configurar metrónomo
  metro.setBpm(bpm);
  metro.setTimeSignature(beatsPerBar, timeSignature.denominator);

  // Si el metrónomo estaba OFF, lo forzamos temporalmente
  _metronomeWasForced = !state.transport.metronomeEnabled;

  // Entrar en fase de count-in (playhead parado, isPlaying=false)
  listenerApi.dispatch(startCountIn());

  console.info(
    `[recordingHandlers] Count-in: ${state.transport.countInBars} bar(s) × ${beatsPerBar} = ${totalBeats} beats @ ${bpm} BPM`
  );

  // startPreCount arranca el metrónomo y llama al callback al terminar
  metro.startPreCount(totalBeats, () => {
    if (!micRecorder) return;

    // Si el metrónomo estaba forzado, lo apagamos ahora
    if (_metronomeWasForced) {
      metro.stop();
      _metronomeWasForced = false;
    }

    listenerApi.dispatch(finishCountIn());
    try {
      micRecorder.startRecording();
      console.info(
        `[recordingHandlers] Count-in ok → grabando en ${armedTrackIds.length} track(s)`
      );
    } catch (err) {
      console.error('[recordingHandlers] Error al arrancar mic tras count-in:', err);
    }
  });
}