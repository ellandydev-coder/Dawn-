// src/state/slices/recording/recordingSlice.ts

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AudioInputDevice } from '@audio/recording/utils/getInputDevices';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export type PermissionStatus =
  | 'idle'
  | 'pending'
  | 'granted'
  | 'denied'
  | 'unavailable'
  | 'error';

export interface RecordingState {
  /** Id del dispositivo de entrada seleccionado (null = default del sistema) */
  selectedDeviceId: string | null;
  /** Dispositivos de entrada disponibles (formato canónico del proyecto) */
  availableDevices: AudioInputDevice[];
  /** Estado del permiso de micrófono */
  permissionStatus: PermissionStatus;
  /** Monitoring de entrada habilitado */
  monitoringEnabled: boolean;
  /** Ganancia de entrada 0..2 (1 = unity gain) */
  inputGain: number;
}

// ═══════════════════════════════════════════════════════════════
// 🎯 ESTADO INICIAL
// ═══════════════════════════════════════════════════════════════

const initialState: RecordingState = {
  selectedDeviceId: null,
  availableDevices: [],
  permissionStatus: 'idle',
  monitoringEnabled: false,
  inputGain: 1,
};

// ═══════════════════════════════════════════════════════════════
// 🎯 SLICE
// ═══════════════════════════════════════════════════════════════

const recordingSlice = createSlice({
  name: 'recording',
  initialState,
  reducers: {
    setSelectedDevice(state, action: PayloadAction<string | null>) {
      state.selectedDeviceId = action.payload;
    },

    setAvailableDevices(state, action: PayloadAction<AudioInputDevice[]>) {
      state.availableDevices = action.payload;
    },

    setPermissionStatus(state, action: PayloadAction<PermissionStatus>) {
      state.permissionStatus = action.payload;
    },

    setMonitoringEnabled(state, action: PayloadAction<boolean>) {
      state.monitoringEnabled = action.payload;
    },

    /**
     * Ganancia de entrada 0..2.
     * 0 = silencio, 1 = unity, 2 = +6dB aproximado.
     */
    setInputGain(state, action: PayloadAction<number>) {
      state.inputGain = Math.max(0, Math.min(2, action.payload));
    },
  },
});

// ═══════════════════════════════════════════════════════════════
// 🎯 EXPORTS
// ═══════════════════════════════════════════════════════════════

export const {
  setSelectedDevice,
  setAvailableDevices,
  setPermissionStatus,
  setMonitoringEnabled,
  setInputGain,
} = recordingSlice.actions;

export default recordingSlice.reducer;