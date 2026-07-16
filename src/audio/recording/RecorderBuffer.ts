// src/audio/recording/RecorderBuffer.ts

/**
 * RecorderBuffer
 * --------------
 * Acumulador de chunks de audio recibidos del RecorderProcessor.
 *
 * - Guarda los Float32Array chunk-a-chunk (evita realloc grandes)
 * - Al finalizar, construye un AudioBuffer contiguo
 * - Trackea nivel de input (peak) para meters de UI
 *
 * NO conoce el worklet ni el AudioContext directamente — recibe
 * chunks y devuelve un AudioBuffer. Fácil de testear.
 */
export class RecorderBuffer {
  private _chunks: Float32Array[][] = []; // [channelIdx][chunkIdx]
  private _totalSamples = 0;
  private _channelCount = 0;
  private _currentPeak = 0;

  /** Añade un chunk multi-canal al buffer */
  public appendChunk(channels: Float32Array[]): void {
    if (this._chunks.length === 0) {
      this._channelCount = channels.length;
      for (let ch = 0; ch < channels.length; ch++) {
        this._chunks.push([]);
      }
    }

    for (let ch = 0; ch < channels.length; ch++) {
      const target = this._chunks[ch];
      const source = channels[ch];
      if (target && source) target.push(source);
    }

    const samplesInBlock = channels[0]?.length ?? 0;
    this._totalSamples += samplesInBlock;

    // Peak del primer canal (aproximación rápida para meter de input)
    const first = channels[0];
    if (first) {
      let peak = 0;
      for (let i = 0; i < first.length; i++) {
        const abs = Math.abs(first[i] ?? 0);
        if (abs > peak) peak = abs;
      }
      this._currentPeak = peak;
    }
  }

  /** Construye un AudioBuffer contiguo con todos los chunks acumulados */
  public toAudioBuffer(ctx: AudioContext): AudioBuffer {
    const numChannels = Math.max(1, this._channelCount);
    const buffer = ctx.createBuffer(
      numChannels,
      Math.max(1, this._totalSamples),
      ctx.sampleRate
    );

    for (let ch = 0; ch < numChannels; ch++) {
      const chunks = this._chunks[ch];
      if (!chunks) continue;

      const channelData = buffer.getChannelData(ch);
      let offset = 0;
      for (const chunk of chunks) {
        channelData.set(chunk, offset);
        offset += chunk.length;
      }
    }

    return buffer;
  }

  /** Limpia todo el estado interno (listo para nuevo take) */
  public reset(): void {
    this._chunks = [];
    this._totalSamples = 0;
    this._channelCount = 0;
    this._currentPeak = 0;
  }

  public get totalSamples(): number {
    return this._totalSamples;
  }

  public get channelCount(): number {
    return this._channelCount;
  }

  public get currentPeak(): number {
    return this._currentPeak;
  }
}