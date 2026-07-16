// src/features/transport/hooks/useMicDevices.ts
//
// Hook que enumera los dispositivos de entrada de audio
// y mantiene Redux sincronizado con cambios (mic conectado/desconectado).

import { useCallback, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@state/store';
import {
  setAvailableDevices,
  setSelectedDevice,
} from '@state/slices/recording/recordingSlice';
import {
  getInputDevices,
  onDevicesChanged,
  type AudioInputDevice,
} from '@audio/recording/utils/getInputDevices';

export interface UseMicDevicesResult {
  /** Lista de dispositivos de entrada disponibles */
  devices: AudioInputDevice[];
  /** deviceId seleccionado (null = default del sistema) */
  selectedDeviceId: string | null;
  /** Cambia el dispositivo seleccionado */
  selectDevice: (deviceId: string | null) => void;
  /** Fuerza una re-enumeración manual */
  refresh: () => Promise<void>;
}

export function useMicDevices(): UseMicDevicesResult {
  const dispatch = useAppDispatch();

  const devices = useAppSelector((s) => s.recording.availableDevices);
  const selectedDeviceId = useAppSelector((s) => s.recording.selectedDeviceId);

  const refresh = useCallback(async () => {
    const list = await getInputDevices();
    dispatch(setAvailableDevices(list));
  }, [dispatch]);

  const selectDevice = useCallback(
    (deviceId: string | null) => {
      dispatch(setSelectedDevice(deviceId));
    },
    [dispatch]
  );

  // Enumeración inicial + suscripción a cambios (mic conectado/desconectado)
  useEffect(() => {
    refresh();
    const unsubscribe = onDevicesChanged(() => {
      refresh();
    });
    return unsubscribe;
  }, [refresh]);

  return { devices, selectedDeviceId, selectDevice, refresh };
}