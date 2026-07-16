/**
 * AssetRegistry
 * -------------
 * Almacén en memoria de AudioBuffers.
 * Los AudioBuffer NO son serializables → no pueden ir en Redux.
 * Aquí guardamos los buffers reales indexados por assetId.
 */
export class AssetRegistry {
  private static _buffers: Map<string, AudioBuffer> = new Map();

  public static register(assetId: string, buffer: AudioBuffer): void {
    this._buffers.set(assetId, buffer);
  }

  public static get(assetId: string): AudioBuffer | undefined {
    return this._buffers.get(assetId);
  }

  public static has(assetId: string): boolean {
    return this._buffers.has(assetId);
  }

  public static remove(assetId: string): void {
    this._buffers.delete(assetId);
  }

  public static clear(): void {
    this._buffers.clear();
  }
}