import { audioEngine } from '@audio/engine/AudioEngine';

/**
 * AssetLoader
 * -----------
 * Descarga o lee archivos de audio y los convierte en AudioBuffer.
 * Soporta:
 *   - loadAudio(url): archivos servidos por HTTP (public/ o remotos)
 *   - loadFromFile(file): archivos del File System del usuario
 */
export class AssetLoader {
  private static _cacheByUrl: Map<string, AudioBuffer> = new Map();

  /** Carga un archivo de audio desde una URL. */
  public static async loadAudio(url: string): Promise<AudioBuffer> {
    if (this._cacheByUrl.has(url)) {
      return this._cacheByUrl.get(url)!;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`No se pudo cargar el audio: ${url}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioEngine.context.decodeAudioData(arrayBuffer);
    this._cacheByUrl.set(url, audioBuffer);

    console.info(
      `[AssetLoader] URL cargada: ${url} — ${audioBuffer.duration.toFixed(2)}s`
    );

    return audioBuffer;
  }

  /** Carga un archivo local (arrastrado o seleccionado por el usuario). */
  public static async loadFromFile(file: File): Promise<AudioBuffer> {
    const arrayBuffer = await file.arrayBuffer();
    // decodeAudioData "consume" el buffer, por eso lo clonamos
    const audioBuffer = await audioEngine.context.decodeAudioData(
      arrayBuffer.slice(0)
    );

    console.info(
      `[AssetLoader] Archivo cargado: ${file.name} — ${audioBuffer.duration.toFixed(2)}s`
    );

    return audioBuffer;
  }

  public static clear(): void {
    this._cacheByUrl.clear();
  }
}