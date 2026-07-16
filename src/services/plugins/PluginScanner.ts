// src/services/plugins/PluginScanner.ts

import type {
  ScanOptions,
  ScanResult,
  ScannedPlugin,
} from './pluginScanner.types';

// ═══════════════════════════════════════════════════════════════
// 🎯 MOCK DATA — plugins fake para el Walking Skeleton
// ═══════════════════════════════════════════════════════════════

/**
 * Lista fake de plugins VST3 populares del mundo real.
 * Usada por el mock del scanner mientras no hay Rust IPC.
 * Cuando se implemente el Hito B (Tauri + Rust), esta lista
 * se elimina — los plugins vendrán del filesystem real.
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
    category: 'utility',
    format: 'vst3',
    version: '1.365',
    path: 'C:\\Program Files\\Common Files\\VST3\\Xfer\\Serum.vst3',
    description: 'Advanced wavetable synthesizer',
    available: true,
  },
];

// ═══════════════════════════════════════════════════════════════
// 🎯 SCANNER
// ═══════════════════════════════════════════════════════════════

/**
 * Servicio de escaneo de plugins.
 *
 * ─── ESTADO ACTUAL (Hito A — Walking Skeleton) ───────────────
 * Este scanner es un MOCK. Ignora las `paths` recibidas y devuelve
 * siempre la misma lista de 6 plugins fake tras un delay artificial,
 * reportando progreso para validar el flow completo.
 *
 * ─── FUTURO (Hito B — Rust IPC) ──────────────────────────────
 * `scan()` invocará `nativeBridge.scanVstPlugins(paths)` que
 * llamará a Rust vía Tauri para recorrer el filesystem real
 * y parsear headers de archivos .vst3.
 *
 * ─── FUTURO (Hito D — Cache) ─────────────────────────────────
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

    // ⚠️  Mock: ignoramos options.paths y devolvemos MOCK_PLUGINS
    // En Hito B se sustituye por invoke IPC a Rust
    const plugins = await this.scanMock(options);

    const durationMs = performance.now() - startTime;

    return {
      plugins,
      scannedPaths: options.paths,
      durationMs,
    };
  }

  /**
   * Implementación mock: simula escaneo con progreso realista.
   */
  private async scanMock(options: ScanOptions): Promise<ScannedPlugin[]> {
    const total = MOCK_PLUGINS.length;
    const found: ScannedPlugin[] = [];

    for (let i = 0; i < total; i++) {
      const plugin = MOCK_PLUGINS[i];

      // Simular tiempo de parsing del plugin
      await this.delay(PluginScannerService.MOCK_DELAY_MS);

      found.push(plugin);

      // Reportar progreso
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