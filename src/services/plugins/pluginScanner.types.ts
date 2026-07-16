// src/services/plugins/pluginScanner.types.ts

import type { FxPluginCategory } from '@domain/enums/FxPluginCategory';
import type { FxPluginFormat } from '@domain/enums/FxPluginFormat';

// ═══════════════════════════════════════════════════════════════
// 🎯 CONTRATOS DEL SCANNER
// ═══════════════════════════════════════════════════════════════

/**
 * Plugin descubierto por el scanner del filesystem.
 *
 * Este es el resultado del escaneo — antes de registrarse en
 * el `FxCatalog`. Contiene toda la info necesaria para crear un
 * `FxPluginInfo` + datos extra útiles para debug (path).
 *
 * ─── DIFERENCIA con FxPluginRegistration (Hito 4) ───
 * `FxPluginRegistration` (built-in) NO tiene `path` porque son
 * plugins compilados dentro del bundle. Los scaneados sí tienen
 * `path` para poder recargar el plugin desde disco.
 */
export interface ScannedPlugin {
  /** Id único (convención: `<format>.<vendor>.<name-slug>`) */
  readonly id: string;

  /** Nombre humano del plugin */
  readonly name: string;

  /** Vendor / fabricante */
  readonly vendor: string;

  /** Categoría (eq, dynamics, reverb, ...) */
  readonly category: FxPluginCategory;

  /** Formato del plugin (vst3, vst2, au, clap) */
  readonly format: FxPluginFormat;

  /** Versión reportada por el plugin */
  readonly version: string;

  /** Ruta absoluta al archivo del plugin */
  readonly path: string;

  /** Descripción corta (opcional, algunos plugins la aportan) */
  readonly description?: string;

  /** Siempre `true` — un plugin scaneado está por definición disponible */
  readonly available: true;
}

/**
 * Resultado completo de un escaneo.
 */
export interface ScanResult {
  /** Plugins encontrados durante el escaneo */
  readonly plugins: readonly ScannedPlugin[];

  /** Rutas que se escanearon (para debug / logging) */
  readonly scannedPaths: readonly string[];

  /** Duración del escaneo en milisegundos */
  readonly durationMs: number;
}

/**
 * Callback de progreso durante el escaneo.
 * @param progress - Valor entre 0 y 1
 * @param currentName - Nombre del plugin que se está procesando
 */
export type ScanProgressCallback = (
  progress: number,
  currentName: string
) => void;

/**
 * Opciones del escaneo.
 */
export interface ScanOptions {
  /**
   * Rutas absolutas donde buscar plugins.
   * En el mock actual se ignora (siempre devuelve la lista fake).
   * En Rust (Hito B) respetará las rutas reales.
   */
  readonly paths: readonly string[];

  /** Callback de progreso opcional */
  readonly onProgress?: ScanProgressCallback;
}