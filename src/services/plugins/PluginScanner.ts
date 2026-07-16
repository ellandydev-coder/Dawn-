// src/services/plugins/PluginScanner.ts

import { nativeBridge, isTauriEnv, type NativeScannedPlugin } from '@services/native/nativeBridge';
import type {
  ScanOptions,
  ScanResult,
  ScannedPlugin,
} from './pluginScanner.types';
import { FX_PLUGIN_CATEGORIES, type FxPluginCategory } from '@domain/enums/FxPluginCategory';
import { FX_PLUGIN_FORMATS, type FxPluginFormat } from '@domain/enums/FxPluginFormat';

// ═══════════════════════════════════════════════════════════════
// 🎯 MOCK DATA — plugins fake (fallback en navegador sin Tauri)
// ═══════════════════════════════════════════════════════════════

/**
 * Lista fake de plugins VST3 populares.
 * Se usa cuando la app corre en `npm run dev` (sin Tauri) —
 * permite desarrollar UI sin depender del filesystem real.
 *
 * En Tauri (`npm run tauri:dev`), esta lista NO se usa: los
 * plugins vienen del comando Rust `scan_vst_plugins`.
 */
const MOCK_PLUGINS: readonly ScannedPlugin[] = [
  {
    id: 'vst3.waves.ssl-e-channel',
    name: 'SSL E-Channel',
    vendor: 'Waves',
    category: 'eq',
    format: 'vst3',
    version: '14.0.0',
    path: 'C:\\Program Files\\Common Files\\VST3\\Waves\\SSL E-Channel.vst3',
    description: 'Classic SSL 4000E channel strip',
    available: true,
  },
  {
    id: 'vst3.fabfilter.pro-q-3',
    name: 'Pro-Q 3',
    vendor: 'FabFilter',
    category: 'eq',
    format: 'vst3',
    version: '3.24',
    path: 'C:\\Program Files\\Common Files\\VST3\\FabFilter\\FabFilter Pro-Q 3.vst3',
    description: 'Professional equalizer plugin',
    available: true,
  },
  {
    id: 'vst3.fabfilter.pro-c-2',
    name: 'Pro-C 2',
    vendor: 'FabFilter',
    category: 'dynamics',
    format: 'vst3',
    version: '2.15',
    path: 'C:\\Program Files\\Common Files\\VST3\\FabFilter\\FabFilter Pro-C 2.vst3',
    description: 'Professional compressor plugin',
    available: true,
  },
  {
    id: 'vst3.valhalla.vintage-verb',
    name: 'ValhallaVintageVerb',
    vendor: 'Valhalla DSP',
    category: 'reverb',
    format: 'vst3',
    version: '3.0.1',
    path: 'C:\\Program Files\\Common Files\\VST3\\Valhalla\\ValhallaVintageVerb.vst3',
    description: 'Vintage-style algorithmic reverb',
    available: true,
  },
  {
    id: 'vst3.soundtoys.echoboy',
    name: 'EchoBoy',
    vendor: 'Soundtoys',
    category: 'delay',
    format: 'vst3',
    version: '5.4.5',
    path: 'C:\\Program Files\\Common Files\\VST3\\Soundtoys\\EchoBoy.vst3',
    description: 'Versatile delay plugin',
    available: true,
  },
  {
    id: 'vst3.xfer.serum',
    name: 'Serum',
    vendor: 'Xfer Records',
    category: 'other',
    format: 'vst3',
    version: '1.365',
    path: 'C:\\Program Files\\Common Files\\VST3\\Xfer\\Serum.vst3',
    description: 'Advanced wavetable synthesizer',
    available: true,
  },
];

// ═══════════════════════════════════════════════════════════════
// 🎯 NORMALIZACIÓN DEL PAYLOAD DE RUST
// ═══════════════════════════════════════════════════════════════

/**
 * Rust puede devolver categorías/formatos como strings arbitrarios.
 * Normalizamos a los enums válidos del dominio para no romper el
 * FxCatalog. Si el valor no es reconocido, cae a un default seguro.
 */

function normalizeCategory(cat: string): FxPluginCategory {
  return (FX_PLUGIN_CATEGORIES as readonly string[]).includes(cat)
    ? (cat as FxPluginCategory)
    : 'other';
}

function normalizeFormat(fmt: string): FxPluginFormat {
  return (FX_PLUGIN_FORMATS as readonly string[]).includes(fmt)
    ? (fmt as FxPluginFormat)
    : 'vst3';
}

// ═══════════════════════════════════════════════════════════════
// 🎯 SCANNER
// ═══════════════════════════════════════════════════════════════

/**
 * Servicio de escaneo de plugins.
 *
 * ─── COMPORTAMIENTO SEGÚN ENTORNO ────────────────────────────
 *
 * En Tauri (`npm run tauri:dev`):
 *   → invoca `nativeBridge.scanVstPlugins(paths)` que llama a Rust.
 *   → Rust recorre el filesystem con `walkdir` y devuelve los
 *     archivos/carpetas `.vst3` encontrados.
 *
 * En navegador (`npm run dev`, sin Tauri):
 *   → cae al MOCK con 6 plugins fake tras un delay simulado.
 *   → permite desarrollar UI sin necesitar Tauri corriendo.
 *
 * ─── LIMITACIONES ACTUALES (Hito B) ──────────────────────────
 * • Los plugins devueltos por Rust tienen name/path reales
 *   pero vendor/category/version son placeholders.
 * • El Hito C parseará metadatos reales del VST3 SDK.
 * • El Hito E añadirá streaming de progreso vía Tauri channels.
 *
 * ─── FUTURO (Hito D) ─────────────────────────────────────────
 * Añadirá lookup en IndexedDB antes de escanear + persistencia
 * de resultados. El re-scan invalidará el cache.
 */
class PluginScannerService {
  private static readonly MOCK_DELAY_MS = 300;

  /**
   * Escanea las rutas indicadas y devuelve los plugins encontrados.
   *
   * @param options - Rutas + callback de progreso opcional
   * @returns Resultado del escaneo con plugins y duración
   */
  public async scan(options: ScanOptions): Promise<ScanResult> {
    const startTime = performance.now();

    const plugins = isTauriEnv()
      ? await this.scanNative(options)
      : await this.scanMock(options);

    const durationMs = performance.now() - startTime;

    return {
      plugins,
      scannedPaths: options.paths,
      durationMs,
    };
  }

  // ───────────────────────────────────────────────────────────
  // 🦀 IMPLEMENTACIÓN NATIVA (Rust vía Tauri IPC)
  // ───────────────────────────────────────────────────────────

  /**
   * Llama al comando Rust `scan_vst_plugins` y convierte
   * `NativeScannedPlugin[]` → `ScannedPlugin[]`.
   *
   * ⚠️  El progreso NO está streameado todavía (Hito E).
   *   Por ahora reporta 0% al inicio y 100% al terminar,
   *   con nombre "(escaneando filesystem…)".
   */
  private async scanNative(options: ScanOptions): Promise<ScannedPlugin[]> {
    // Progreso inicial (Rust no reporta progreso hoy, solo start/end)
    options.onProgress?.(0, '(escaneando filesystem…)');

    const nativePlugins = await nativeBridge.scanVstPlugins([...options.paths]);

    // Convertir + validar cada plugin devuelto por Rust
    const plugins: ScannedPlugin[] = nativePlugins.map((raw) =>
      this.fromNative(raw)
    );

    // Progreso final
    options.onProgress?.(1, '(escaneo completo)');

    return plugins;
  }

  /**
   * Convierte un `NativeScannedPlugin` (payload crudo de Rust) a
   * `ScannedPlugin` (tipo del scanner con categorías validadas).
   *
   * `available` se marca siempre a `true`: si Rust devolvió el plugin
   * es porque existe en el filesystem — está disponible por definición.
   */
  private fromNative(raw: NativeScannedPlugin): ScannedPlugin {
    return {
      id: raw.id,
      name: raw.name,
      vendor: raw.vendor,
      category: normalizeCategory(raw.category),
      format: normalizeFormat(raw.format),
      version: raw.version,
      path: raw.path,
      available: true,
    };
  }

  // ───────────────────────────────────────────────────────────
  // 🧪 IMPLEMENTACIÓN MOCK (fallback en navegador sin Tauri)
  // ───────────────────────────────────────────────────────────

  /**
   * Simula escaneo con progreso realista.
   * Devuelve los 6 plugins fake tras ~1.8 segundos.
   */
  private async scanMock(options: ScanOptions): Promise<ScannedPlugin[]> {
    const total = MOCK_PLUGINS.length;
    const found: ScannedPlugin[] = [];

    for (let i = 0; i < total; i++) {
      const plugin = MOCK_PLUGINS[i];

      await this.delay(PluginScannerService.MOCK_DELAY_MS);

      found.push(plugin);

      const progress = (i + 1) / total;
      options.onProgress?.(progress, plugin.name);
    }

    return found;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ═══════════════════════════════════════════════════════════════
// 🎯 SINGLETON
// ═══════════════════════════════════════════════════════════════

export const PluginScanner = new PluginScannerService();