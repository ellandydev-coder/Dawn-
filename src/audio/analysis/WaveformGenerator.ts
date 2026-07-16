/**
 * WaveformGenerator
 * -----------------
 * Genera peaks (min/max) de un AudioBuffer para renderizar waveforms.
 *
 * Soporta:
 *   - Multi-canal (mono, estéreo, N canales)
 *   - Caché con LRU (evita memory leaks)
 *   - Multi-resolución (útil para zoom eficiente)
 *   - Normalización opcional
 *   - RMS calculado
 *   - Generación async chunked (no bloquea UI en buffers grandes)
 *   - Downsample de peaks existentes (zoom rápido sin re-procesar buffer)
 *   - Invalidación selectiva del caché
 *
 * Uso típico:
 *   const peaks = WaveformGenerator.getOrCreate(assetId, buffer, 2000);
 *   renderCanvas(peaks.min[0], peaks.max[0]);
 */

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

export interface WaveformPeaks {
  /** Array por canal → Float32Array de mínimos por pixel */
  min: Float32Array[];
  /** Array por canal → Float32Array de máximos por pixel */
  max: Float32Array[];
  /** Array por canal → Float32Array de RMS por pixel */
  rms: Float32Array[];
  /** Número de canales */
  channels: number;
  /** Ancho en píxeles (número de puntos) */
  length: number;
  /** Duración original del buffer en segundos */
  duration: number;
  /** Sample rate original */
  sampleRate: number;
  /** ¿Están normalizados los peaks? */
  normalized: boolean;
}

export interface GenerateOptions {
  /** Normalizar peaks a [-1, 1] según el máximo real */
  normalize?: boolean;
  /** Solo generar canal específico (default: todos) */
  channelIndex?: number;
  /** Callback de progreso (0–1) */
  onProgress?: (progress: number) => void;
}

// ═══════════════════════════════════════════
// Constantes
// ═══════════════════════════════════════════

const MAX_CACHE_ENTRIES = 100;
const CACHE_KEY_SEPARATOR = '::';

/**
 * Cuántos píxeles procesar por chunk en generateAsync.
 * ~2048 píxeles por chunk da buen balance entre latencia y throughput.
 */
const ASYNC_CHUNK_SIZE = 2048;

/**
 * Progreso: reportar cada N píxeles para no saturar callbacks.
 */
const PROGRESS_REPORT_INTERVAL = 256;

// ═══════════════════════════════════════════
// LRU Cache
// ═══════════════════════════════════════════

class LRUCache<K, V> {
  private readonly _map = new Map<K, V>();
  private readonly _maxSize: number;

  constructor(maxSize: number) {
    this._maxSize = Math.max(1, maxSize);
  }

  get(key: K): V | undefined {
    const value = this._map.get(key);
    if (value !== undefined) {
      // Mover al final (más reciente)
      this._map.delete(key);
      this._map.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this._map.has(key)) {
      this._map.delete(key);
    } else if (this._map.size >= this._maxSize) {
      // Eliminar el más antiguo (primero en el Map)
      const oldest = this._map.keys().next().value;
      if (oldest !== undefined) this._map.delete(oldest);
    }
    this._map.set(key, value);
  }

  has(key: K): boolean {
    return this._map.has(key);
  }

  delete(key: K): boolean {
    return this._map.delete(key);
  }

  clear(): void {
    this._map.clear();
  }

  keys(): IterableIterator<K> {
    return this._map.keys();
  }

  get size(): number {
    return this._map.size;
  }

  get maxSize(): number {
    return this._maxSize;
  }
}

// ═══════════════════════════════════════════
// Cache global
// ═══════════════════════════════════════════

const cache = new LRUCache<string, WaveformPeaks>(MAX_CACHE_ENTRIES);

// ═══════════════════════════════════════════
// Helpers puros
// ═══════════════════════════════════════════

const makeCacheKey = (
  assetId: string,
  targetWidth: number,
  options?: GenerateOptions
): string => {
  const norm = options?.normalize ? 'n' : '';
  const ch =
    options?.channelIndex !== undefined ? `c${options.channelIndex}` : 'all';
  return `${assetId}${CACHE_KEY_SEPARATOR}${targetWidth}${CACHE_KEY_SEPARATOR}${ch}${norm}`;
};

function validateBuffer(buffer: AudioBuffer | null | undefined): asserts buffer is AudioBuffer {
  if (!buffer) {
    throw new Error('[WaveformGenerator] AudioBuffer requerido');
  }
  if (buffer.length === 0) {
    throw new Error('[WaveformGenerator] AudioBuffer vacío');
  }
}

function validateTargetWidth(targetWidth: number): asserts targetWidth is number {
  if (!Number.isFinite(targetWidth) || targetWidth <= 0) {
    throw new Error(
      `[WaveformGenerator] targetWidth inválido: ${targetWidth}`
    );
  }
}

const createEmptyPeaks = (
  channels: number,
  length: number,
  sampleRate: number
): WaveformPeaks => ({
  min: Array.from({ length: channels }, () => new Float32Array(length)),
  max: Array.from({ length: channels }, () => new Float32Array(length)),
  rms: Array.from({ length: channels }, () => new Float32Array(length)),
  channels,
  length,
  duration: 0,
  sampleRate,
  normalized: false,
});

/**
 * Escala todos los arrays de peaks in-place por un factor.
 */
function scalePeaksInPlace(peaks: WaveformPeaks, scale: number): void {
  for (let ch = 0; ch < peaks.channels; ch++) {
    const minArr = peaks.min[ch];
    const maxArr = peaks.max[ch];
    const rmsArr = peaks.rms[ch];

    for (let i = 0; i < peaks.length; i++) {
      minArr[i] *= scale;
      maxArr[i] *= scale;
      rmsArr[i] *= scale;
    }
  }
}

/**
 * Resuelve qué canales procesar dados los options y el buffer.
 */
function resolveChannels(
  totalChannels: number,
  channelIndex?: number
): number[] {
  if (channelIndex !== undefined && channelIndex >= 0 && channelIndex < totalChannels) {
    return [channelIndex];
  }
  return Array.from({ length: totalChannels }, (_, i) => i);
}

/**
 * Procesa un rango de píxeles de un canal y escribe en los arrays de destino.
 * Retorna el máximo absoluto encontrado en el rango.
 */
function processPixelRange(
  channelData: Float32Array,
  samplesPerPixel: number,
  bufferLength: number,
  minArr: Float32Array,
  maxArr: Float32Array,
  rmsArr: Float32Array,
  startPixel: number,
  endPixel: number
): number {
  let localMax = 0;

  for (let x = startPixel; x < endPixel; x++) {
    const sampleStart = x * samplesPerPixel;
    const sampleEnd = Math.min(sampleStart + samplesPerPixel, bufferLength);

    let mn = 1.0;
    let mx = -1.0;
    let sumSquares = 0;
    let count = 0;

    for (let i = sampleStart; i < sampleEnd; i++) {
      const v = channelData[i];
      if (v < mn) mn = v;
      if (v > mx) mx = v;
      sumSquares += v * v;
      count++;
    }

    minArr[x] = mn;
    maxArr[x] = mx;
    rmsArr[x] = count > 0 ? Math.sqrt(sumSquares / count) : 0;

    const absMax = Math.max(Math.abs(mn), Math.abs(mx));
    if (absMax > localMax) localMax = absMax;
  }

  return localMax;
}

// ═══════════════════════════════════════════
// WaveformGenerator
// ═══════════════════════════════════════════

export class WaveformGenerator {
  /**
   * Genera peaks síncronamente (bloquea el thread).
   * Usar para buffers pequeños (<5 MB / <30s).
   *
   * @throws {Error} Si buffer o targetWidth son inválidos
   */
  public static generate(
    buffer: AudioBuffer,
    targetWidth: number,
    options: GenerateOptions = {}
  ): WaveformPeaks {
    validateBuffer(buffer);
    validateTargetWidth(targetWidth);

    const { normalize = false, channelIndex, onProgress } = options;
    const channelsToProcess = resolveChannels(buffer.numberOfChannels, channelIndex);
    const width = Math.max(1, Math.floor(targetWidth));
    const samplesPerPixel = Math.max(1, Math.floor(buffer.length / width));

    const peaks = createEmptyPeaks(channelsToProcess.length, width, buffer.sampleRate);
    peaks.duration = buffer.duration;

    let globalMax = 0;

    for (let chIdx = 0; chIdx < channelsToProcess.length; chIdx++) {
      const channelData = buffer.getChannelData(channelsToProcess[chIdx]);

      const chMax = processPixelRange(
        channelData,
        samplesPerPixel,
        buffer.length,
        peaks.min[chIdx],
        peaks.max[chIdx],
        peaks.rms[chIdx],
        0,
        width
      );

      if (chMax > globalMax) globalMax = chMax;

      // Progreso por canal
      if (onProgress) {
        onProgress((chIdx + 1) / channelsToProcess.length);
      }
    }

    // Normalización
    if (normalize && globalMax > 0 && globalMax !== 1) {
      scalePeaksInPlace(peaks, 1 / globalMax);
      peaks.normalized = true;
    }

    onProgress?.(1);
    return peaks;
  }

  /**
   * Genera peaks asincrónicamente en chunks (no bloquea la UI).
   * Ideal para buffers grandes (>5 MB) o cuando quieres mostrar progreso.
   *
   * Usa requestIdleCallback si disponible, sino setTimeout(0).
   *
   * @example
   * const peaks = await WaveformGenerator.generateAsync(buffer, 2000, {
   *   onProgress: (p) => setProgress(p),
   * });
   */
  public static async generateAsync(
    buffer: AudioBuffer,
    targetWidth: number,
    options: GenerateOptions = {}
  ): Promise<WaveformPeaks> {
    validateBuffer(buffer);
    validateTargetWidth(targetWidth);

    const { normalize = false, channelIndex, onProgress } = options;
    const channelsToProcess = resolveChannels(buffer.numberOfChannels, channelIndex);
    const width = Math.max(1, Math.floor(targetWidth));
    const samplesPerPixel = Math.max(1, Math.floor(buffer.length / width));

    const peaks = createEmptyPeaks(channelsToProcess.length, width, buffer.sampleRate);
    peaks.duration = buffer.duration;

    const totalWork = channelsToProcess.length * width;
    let completedWork = 0;
    let globalMax = 0;

    const scheduleChunk = (): Promise<void> =>
      new Promise((resolve) => {
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(() => resolve());
        } else {
          setTimeout(resolve, 0);
        }
      });

    for (let chIdx = 0; chIdx < channelsToProcess.length; chIdx++) {
      const channelData = buffer.getChannelData(channelsToProcess[chIdx]);
      let pixelOffset = 0;

      while (pixelOffset < width) {
        const chunkEnd = Math.min(pixelOffset + ASYNC_CHUNK_SIZE, width);

        const chunkMax = processPixelRange(
          channelData,
          samplesPerPixel,
          buffer.length,
          peaks.min[chIdx],
          peaks.max[chIdx],
          peaks.rms[chIdx],
          pixelOffset,
          chunkEnd
        );

        if (chunkMax > globalMax) globalMax = chunkMax;

        completedWork += chunkEnd - pixelOffset;
        pixelOffset = chunkEnd;

        // Reportar progreso
        if (onProgress && completedWork % PROGRESS_REPORT_INTERVAL < ASYNC_CHUNK_SIZE) {
          onProgress(completedWork / totalWork);
        }

        // Ceder el thread
        await scheduleChunk();
      }
    }

    // Normalización
    if (normalize && globalMax > 0 && globalMax !== 1) {
      scalePeaksInPlace(peaks, 1 / globalMax);
      peaks.normalized = true;
    }

    onProgress?.(1);
    return peaks;
  }

  /**
   * Obtiene peaks del caché o los genera si no existen.
   * Método recomendado para uso general.
   */
  public static getOrCreate(
    assetId: string,
    buffer: AudioBuffer,
    targetWidth: number,
    options: GenerateOptions = {}
  ): WaveformPeaks {
    const key = makeCacheKey(assetId, targetWidth, options);

    const cached = cache.get(key);
    if (cached) return cached;

    const peaks = this.generate(buffer, targetWidth, options);
    cache.set(key, peaks);
    return peaks;
  }

  /**
   * Versión async de getOrCreate.
   */
  public static async getOrCreateAsync(
    assetId: string,
    buffer: AudioBuffer,
    targetWidth: number,
    options: GenerateOptions = {}
  ): Promise<WaveformPeaks> {
    const key = makeCacheKey(assetId, targetWidth, options);

    const cached = cache.get(key);
    if (cached) return cached;

    const peaks = await this.generateAsync(buffer, targetWidth, options);
    cache.set(key, peaks);
    return peaks;
  }

  /**
   * Invalida el caché.
   *   - Sin argumentos: limpia todo
   *   - Con assetId: limpia solo entradas de ese asset
   */
  public static clearCache(assetId?: string): void {
    if (!assetId) {
      cache.clear();
      return;
    }

    const prefix = `${assetId}${CACHE_KEY_SEPARATOR}`;
    const keysToDelete: string[] = [];

    for (const key of cache.keys()) {
      if (key.startsWith(prefix)) keysToDelete.push(key);
    }

    for (const key of keysToDelete) {
      cache.delete(key);
    }
  }

  /**
   * Estadísticas del caché (útil para debugging / DevTools).
   */
  public static getCacheStats(): {
    size: number;
    maxSize: number;
    keys: string[];
  } {
    return {
      size: cache.size,
      maxSize: cache.maxSize,
      keys: Array.from(cache.keys()),
    };
  }

  /**
   * Downsamplea peaks existentes para zoom rápido.
   * Mucho más rápido que regenerar desde el AudioBuffer.
   *
   * @example
   * const detailed = WaveformGenerator.getOrCreate(id, buffer, 4000);
   * const zoomedOut = WaveformGenerator.downsample(detailed, 500);
   */
  public static downsample(
    peaks: WaveformPeaks,
    newWidth: number
  ): WaveformPeaks {
    if (!Number.isFinite(newWidth) || newWidth <= 0) return peaks;
    if (newWidth >= peaks.length) return peaks;

    const ratio = peaks.length / newWidth;
    const result = createEmptyPeaks(peaks.channels, newWidth, peaks.sampleRate);
    result.duration = peaks.duration;
    result.normalized = peaks.normalized;

    for (let ch = 0; ch < peaks.channels; ch++) {
      const srcMin = peaks.min[ch];
      const srcMax = peaks.max[ch];
      const srcRms = peaks.rms[ch];
      const dstMin = result.min[ch];
      const dstMax = result.max[ch];
      const dstRms = result.rms[ch];

      for (let x = 0; x < newWidth; x++) {
        const start = Math.floor(x * ratio);
        const end = Math.min(Math.floor((x + 1) * ratio), peaks.length);

        let mn = 1.0;
        let mx = -1.0;
        let rmsSum = 0;
        let count = 0;

        for (let i = start; i < end; i++) {
          if (srcMin[i] < mn) mn = srcMin[i];
          if (srcMax[i] > mx) mx = srcMax[i];
          rmsSum += srcRms[i];
          count++;
        }

        dstMin[x] = mn;
        dstMax[x] = mx;
        dstRms[x] = count > 0 ? rmsSum / count : 0;
      }
    }

    return result;
  }
}