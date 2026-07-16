// src/services/plugins/pluginScanner.thunks.ts

import { createAsyncThunk } from '@reduxjs/toolkit';
import type { RootState, AppDispatch } from '@state/store';
import {
  scanStarted,
  scanProgressUpdated,
  scanFinished,
  scanFailed,
} from '@state/slices/pluginScan/pluginScanSlice';
import { FxCatalog } from '@services/fx-catalog/FxCatalog';
import { PluginScanner } from './PluginScanner';
import type { ScannedPlugin } from './pluginScanner.types';

// ═══════════════════════════════════════════════════════════════
// 🎯 HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Convierte el string `pluginPaths` (separado por `;`) a un array.
 * Filtra rutas vacías y hace trim de espacios.
 */
function parsePluginPaths(pathsString: string): string[] {
  return pathsString
    .split(';')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Convierte un ScannedPlugin (contrato del scanner) a un objeto
 * compatible con FxCatalog.register (FxPluginInfo).
 *
 * El `path` no viaja al catálogo — es solo metadata del scan.
 * Si se necesita en el futuro (para recargar el plugin), habría
 * que extender FxPluginInfo con un campo opcional `sourcePath`.
 */
function toFxPluginInfo(scanned: ScannedPlugin) {
  return {
    id: scanned.id,
    name: scanned.name,
    vendor: scanned.vendor,
    category: scanned.category,
    format: scanned.format,
    version: scanned.version,
    description: scanned.description ?? '',
    available: scanned.available,
  };
}

// ═══════════════════════════════════════════════════════════════
// 🎯 THUNK: startPluginScan
// ═══════════════════════════════════════════════════════════════

/**
 * Thunk que orquesta el escaneo completo de plugins.
 *
 * Flow:
 *   1. Lee las rutas de VstPreferences.pluginPaths
 *   2. dispatch(scanStarted)
 *   3. Invalida ids del último scan (unregister del FxCatalog)
 *   4. Ejecuta el scanner con callback de progreso
 *   5. Registra los plugins encontrados en el FxCatalog
 *   6. dispatch(scanFinished) con foundIds + duración
 *
 * Errores → dispatch(scanFailed).
 *
 * ⚠️  Idempotente: si ya hay un scan en curso, hace early-return.
 */
export const startPluginScan = createAsyncThunk<
  void,
  void,
  {
    state: RootState;
    dispatch: AppDispatch;
  }
>('pluginScan/start', async (_, { dispatch, getState }) => {
  const state = getState();

  // Early-return si ya hay un scan en curso
  if (state.pluginScan.isScanning) {
    console.warn('[pluginScan] Ya hay un escaneo en curso — ignorando');
    return;
  }

  // 1. Leer rutas configuradas
  const pathsString = state.preferences.vst.pluginPaths;
  const paths = parsePluginPaths(pathsString);

  console.info(
    `[pluginScan] Iniciando escaneo de ${paths.length} ruta(s): ${
      paths.join(', ') || '(sin rutas, usando mock)'
    }`
  );

  // 2. Marcar inicio en Redux
  dispatch(scanStarted());

  try {
    // 3. Invalidar el scan anterior — quitar del FxCatalog los ids
    //    encontrados en el escaneo previo
    const previousIds = state.pluginScan.foundIds;
    for (const id of previousIds) {
      FxCatalog.unregister(id);
    }

    // 4. Ejecutar el scanner con reporte de progreso
    const result = await PluginScanner.scan({
      paths,
      onProgress: (progress, currentName) => {
        dispatch(scanProgressUpdated({ progress, currentName }));
      },
    });

    // 5. Registrar cada plugin en el FxCatalog
    const foundIds: string[] = [];
    for (const plugin of result.plugins) {
      FxCatalog.register(toFxPluginInfo(plugin));
      foundIds.push(plugin.id);
    }

    // 6. Marcar fin en Redux
    dispatch(
      scanFinished({
        foundIds,
        durationMs: result.durationMs,
      })
    );

    console.info(
      `[pluginScan] Escaneo completo: ${foundIds.length} plugins en ${result.durationMs.toFixed(
        0
      )}ms`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[pluginScan] Error durante el escaneo:', err);
    dispatch(scanFailed(message));
  }
});