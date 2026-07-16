import { nanoid } from 'nanoid';
import { AssetLoader } from '@services/assets/AssetLoader';
import { AssetRegistry } from '@services/assets/AssetRegistry';
import type { Asset } from '@domain/models/Asset';

/**
 * FileImportService
 * -----------------
 * Orquesta la importación de archivos de audio.
 * BLOQUEA formatos de video (mp4, avi, mkv, mov, wmv)
 * aunque el navegador los reporte como "audio/mp4".
 */
export class FileImportService {
  // Extensiones de AUDIO permitidas
  private static readonly ALLOWED_EXTENSIONS = [
    'wav', 'mp3', 'ogg', 'flac', 'aac', 'm4a', 'webm',
  ];

  // Extensiones de VIDEO bloqueadas explícitamente
  private static readonly BLOCKED_EXTENSIONS = [
    'mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm_video', '3gp',
  ];

  public static isSupportedFile(file: File): boolean {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

    // Bloquear video explícitamente
    if (this.BLOCKED_EXTENSIONS.includes(ext)) return false;

    // Solo permitir extensiones conocidas de audio
    return this.ALLOWED_EXTENSIONS.includes(ext);
  }

  /** Importa un solo archivo. Devuelve la metadata para meter en Redux. */
  public static async importFile(file: File): Promise<Asset> {
    if (!this.isSupportedFile(file)) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'desconocido';
      throw new Error(
        `Formato no soportado: .${ext} — Usa: WAV, MP3, OGG, FLAC, AAC o M4A`
      );
    }

    const buffer = await AssetLoader.loadFromFile(file);
    const id = nanoid();

    AssetRegistry.register(id, buffer);

    const asset: Asset = {
      id,
      name: file.name,
      duration: buffer.duration,
      sampleRate: buffer.sampleRate,
      numberOfChannels: buffer.numberOfChannels,
      sizeBytes: file.size,
      source: 'file',
      createdAt: Date.now(),
    };

    return asset;
  }

  /** Importa varios archivos en paralelo. */
  public static async importFiles(files: FileList | File[]): Promise<Asset[]> {
    const filesArray = Array.from(files);
    const results = await Promise.allSettled(
      filesArray.map((f) => this.importFile(f))
    );

    const success: Asset[] = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        success.push(r.value);
      } else {
        console.warn(`⚠️ Rechazado: ${filesArray[i].name} — ${r.reason}`);
      }
    });

    return success;
  }

  /** Lista de formatos soportados (para mostrar en UI). */
  public static getSupportedFormats(): string[] {
    return [...this.ALLOWED_EXTENSIONS];
  }
}