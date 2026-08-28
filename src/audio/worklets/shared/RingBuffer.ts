// src/audio/worklets/shared/RingBuffer.ts
//
// Ring buffer SPSC float32 planar (un canal).
// Índices en Int32Array compartido: [writeIdx, readIdx].

export class FloatRingBuffer {
  private readonly _data: Float32Array;
  private readonly _indices: Int32Array;
  private readonly _capacity: number;

  /**
   * @param sab SharedArrayBuffer con espacio:
   *   8 bytes índices (2 * int32) + capacity * 4 bytes samples
   */
  constructor(sab: SharedArrayBuffer, capacity: number) {
    this._capacity = capacity;
    this._indices = new Int32Array(sab, 0, 2);
    this._data = new Float32Array(sab, 8, capacity);
  }

  static bytesNeeded(capacity: number): number {
    return 8 + capacity * 4;
  }

  get capacity(): number {
    return this._capacity;
  }

  availableRead(): number {
    const w = Atomics.load(this._indices, 0);
    const r = Atomics.load(this._indices, 1);
    return (w - r + this._capacity) % this._capacity;
  }

  availableWrite(): number {
    return this._capacity - 1 - this.availableRead();
  }

  /** Escribe hasta `frames` samples. Devuelve escritos. */
  write(src: Float32Array, frames: number): number {
    let written = 0;
    let w = Atomics.load(this._indices, 0);
    const r = Atomics.load(this._indices, 1);

    while (written < frames) {
      const next = (w + 1) % this._capacity;
      if (next === r) break; // lleno
      this._data[w] = src[written] ?? 0;
      w = next;
      written++;
    }
    Atomics.store(this._indices, 0, w);
    return written;
  }

  /** Lee hasta `frames`. Devuelve leídos. */
  read(dst: Float32Array, frames: number): number {
    let read = 0;
    let r = Atomics.load(this._indices, 1);
    const w = Atomics.load(this._indices, 0);

    while (read < frames) {
      if (r === w) break; // vacío
      dst[read] = this._data[r] ?? 0;
      r = (r + 1) % this._capacity;
      read++;
    }
    Atomics.store(this._indices, 1, r);
    return read;
  }

  clear(): void {
    Atomics.store(this._indices, 0, 0);
    Atomics.store(this._indices, 1, 0);
  }
}