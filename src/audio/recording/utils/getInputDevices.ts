// src/audio/recording/utils/getInputDevices.ts

/**
 * getInputDevices
 * ---------------
 * Enumera los dispositivos de entrada de audio disponibles.
 *
 * En Windows, el navegador expone el mismo mic físico 3 veces:
 *   - "Predeterminado - X"       (default del sistema)
 *   - "Comunicaciones - X"       (default de VoIP)
 *   - "X"                        (dispositivo físico real)
 *
 * Aquí deduplicamos por groupId y limpiamos los labels
 * para mostrar solo el nombre real de cada mic físico.
 *
 * NOTA: los labels solo están disponibles DESPUÉS de que el usuario
 * haya concedido permiso de micrófono al menos una vez.
 */

export interface AudioInputDevice {
  /** ID único del dispositivo (persiste entre sesiones en el mismo navegador) */
  deviceId: string;
  /** Nombre legible del dispositivo, ya limpio */
  label: string;
  /** ID del grupo (dispositivos del mismo hardware comparten groupId) */
  groupId: string;
  /** true si es el dispositivo por defecto del sistema */
  isDefault: boolean;
}

// ─── Limpieza de labels ────────────────────────────────────────────────────────

/** Prefijos de rol que Windows/Chromium añade al label. */
const ROLE_PREFIXES = [
  /^Predeterminado\s*[-–—]\s*/i,
  /^Comunicaciones\s*[-–—]\s*/i,
  /^Default\s*[-–—]\s*/i,
  /^Communications\s*[-–—]\s*/i,
];

/** Códigos hex USB al final tipo "(320c:1b0a)" */
const USB_HEX_SUFFIX = /\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i;

/**
 * Limpia el label crudo del navegador para dejar solo el nombre útil.
 * Ejemplos:
 *   "Predeterminado - Micrófono (2- HD USB Audio Device) (320c:1b0a)"
 *   → "Micrófono (2- HD USB Audio Device)"
 */
function cleanLabel(rawLabel: string): string {
  let label = rawLabel.trim();

  for (const prefix of ROLE_PREFIXES) {
    label = label.replace(prefix, '');
  }

  label = label.replace(USB_HEX_SUFFIX, '');

  // Colapsar espacios múltiples y paréntesis vacíos
  label = label.replace(/\s+/g, ' ').replace(/\(\s*\)/g, '').trim();

  return label;
}

/**
 * Prioridad para elegir la "mejor" representación de un mic físico
 * cuando hay varias entradas con el mismo groupId.
 *
 * Menor número = mejor. Preferimos siempre la entrada "real"
 * (sin prefijo de rol), luego el default, luego el resto.
 */
function pickBestVariantScore(rawLabel: string, deviceId: string): number {
  if (deviceId === 'default') return 2;
  if (deviceId === 'communications') return 3;
  if (/^(Predeterminado|Default)\s*[-–—]/i.test(rawLabel)) return 2;
  if (/^(Comunicaciones|Communications)\s*[-–—]/i.test(rawLabel)) return 3;
  return 1; // entrada física "cruda" — es la que queremos
}

// ─── API pública ───────────────────────────────────────────────────────────────

/**
 * Devuelve la lista de micrófonos/entradas de audio, ya deduplicada
 * y con labels legibles.
 */
export async function getInputDevices(): Promise<AudioInputDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    console.warn('[getInputDevices] enumerateDevices no disponible');
    return [];
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices.filter((d) => d.kind === 'audioinput');

    // Detectar qué groupId es el "default" del sistema (mirando el deviceId 'default')
    const defaultEntry = inputs.find((d) => d.deviceId === 'default');
    const defaultGroupId = defaultEntry?.groupId ?? null;

    // Agrupar por groupId
    const byGroup = new Map<string, MediaDeviceInfo[]>();
    for (const d of inputs) {
      const key = d.groupId || d.deviceId; // fallback si no hay groupId
      const bucket = byGroup.get(key);
      if (bucket) bucket.push(d);
      else byGroup.set(key, [d]);
    }

    const result: AudioInputDevice[] = [];
    let fallbackIndex = 1;

    for (const [groupId, variants] of byGroup) {
      // Elegir la mejor variante (la entrada "cruda" del hardware)
      const best = variants.reduce((acc, cur) =>
        pickBestVariantScore(cur.label, cur.deviceId) <
        pickBestVariantScore(acc.label, acc.deviceId)
          ? cur
          : acc
      );

      const cleanedLabel = cleanLabel(best.label);
      const finalLabel = cleanedLabel || `Micrófono ${fallbackIndex++}`;

      result.push({
        deviceId: best.deviceId,
        label: finalLabel,
        groupId,
        isDefault: defaultGroupId !== null && groupId === defaultGroupId,
      });
    }

    // Ordenar: default primero, luego alfabético
    result.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return a.label.localeCompare(b.label);
    });

    return result;
  } catch (err) {
    console.error('[getInputDevices] Error al enumerar dispositivos:', err);
    return [];
  }
}

/**
 * Suscribe a cambios de dispositivos (mic conectado/desconectado).
 * @returns función para desuscribirse
 */
export function onDevicesChanged(callback: () => void): () => void {
  if (!navigator.mediaDevices?.addEventListener) {
    return () => {};
  }

  navigator.mediaDevices.addEventListener('devicechange', callback);
  return () => {
    navigator.mediaDevices.removeEventListener('devicechange', callback);
  };
}