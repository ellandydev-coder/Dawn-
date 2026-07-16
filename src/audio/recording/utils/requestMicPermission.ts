// src/audio/recording/utils/requestMicPermission.ts

/**
 * requestMicPermission
 * --------------------
 * Solicita acceso al micrófono del usuario.
 *
 * Flujo:
 * 1. Chequea si la API está disponible
 * 2. Pide getUserMedia({ audio: true })
 * 3. Devuelve el stream (para reutilizarlo) o el error
 *
 * IMPORTANTE: el stream devuelto está ACTIVO. El caller debe:
 * - Usarlo para crear un MediaStreamAudioSourceNode, O
 * - Llamar stopStream() si solo quería comprobar el permiso
 */

export type MicPermissionStatus =
  | 'granted'
  | 'denied'
  | 'prompt'
  | 'unavailable';

export interface MicPermissionResult {
  status: MicPermissionStatus;
  stream: MediaStream | null;
}

/**
 * Pide permiso de micrófono al usuario.
 * Si se concede, devuelve el MediaStream activo.
 *
 * @param deviceId  ID del dispositivo específico (opcional).
 *                  Si no se pasa, usa el micrófono por defecto.
 */
export async function requestMicPermission(
  deviceId?: string
): Promise<MicPermissionResult> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return { status: 'unavailable', stream: null };
  }

  const constraints: MediaStreamConstraints = {
    audio: deviceId
      ? { deviceId: { exact: deviceId } }
      : true,
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return { status: 'granted', stream };
  } catch (err) {
    if (err instanceof DOMException) {
      if (
        err.name === 'NotAllowedError' ||
        err.name === 'PermissionDeniedError'
      ) {
        return { status: 'denied', stream: null };
      }
      if (err.name === 'NotFoundError') {
        return { status: 'unavailable', stream: null };
      }
    }
    return { status: 'denied', stream: null };
  }
}

/**
 * Chequea el estado del permiso SIN pedirlo.
 * No todos los navegadores soportan esto.
 */
export async function checkMicPermission(): Promise<MicPermissionStatus> {
  if (!navigator.permissions?.query) {
    return 'prompt';
  }

  try {
    const result = await navigator.permissions.query({
      name: 'microphone' as PermissionName,
    });

    switch (result.state) {
      case 'granted': return 'granted';
      case 'denied':  return 'denied';
      default:        return 'prompt';
    }
  } catch {
    return 'prompt';
  }
}

/**
 * Detiene todos los tracks de un MediaStream.
 * Llamar siempre que ya no necesites el stream (libera el mic).
 */
export function stopStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}