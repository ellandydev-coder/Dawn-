// vite.config.ts

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════════════════
// 📦 CODE SPLITTING — Vendor chunks
// --------------------------------------------------------------
// Extraemos las dependencias de terceros a chunks separados para:
//   • Mejor caching HTTP (los vendors casi nunca cambian)
//   • Bundle principal más pequeño (mejor time-to-interactive)
//   • Al actualizar el código de la app, el usuario solo re-descarga
//     el chunk `index-*.js`; React/Redux/Zod se sirven del cache
//
// ⚠️ Nota: Vite 8 usa Rolldown (no Rollup clásico).
// Rolldown NO soporta aún el formato objeto `{ 'chunk': [...] }`
// de manualChunks — solo la forma funcional (moduleId => chunkName).
// ═══════════════════════════════════════════════════════════════

function manualChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined;

  // React ecosystem — cambia poco, cache muy largo
  if (
    id.includes('/react/') ||
    id.includes('/react-dom/') ||
    id.includes('/react-redux/') ||
    id.includes('/scheduler/') ||
    id.includes('/use-sync-external-store/')
  ) {
    return 'vendor-react';
  }

  // Redux Toolkit + Reselect + Immer (state management)
  if (
    id.includes('/@reduxjs/toolkit') ||
    id.includes('/redux/') ||
    id.includes('/redux-thunk/') ||
    id.includes('/reselect/') ||
    id.includes('/immer/')
  ) {
    return 'vendor-redux';
  }

  // Zod (validación de esquemas del dominio)
  if (id.includes('/zod/')) {
    return 'vendor-zod';
  }

  // Resto de vendors → vendor común
  return 'vendor';
}

// ═══════════════════════════════════════════════════════════════
// 🖥️ TAURI — Config específica para el modo escritorio
// --------------------------------------------------------------
// - clearScreen: false → mantiene los logs de Rust visibles.
// - server.port: 5173 fijo, sin cambiar si está ocupado.
// - server.strictPort: falla si el puerto no está libre.
// - server.watch.ignored: no observar src-tauri (evita rebuilds
//   circulares cuando Rust recompila).
// - envPrefix: expone variables TAURI_ al frontend.
// ═══════════════════════════════════════════════════════════════

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],

  // 🔇 Tauri controla el output → no limpiar la consola
  clearScreen: false,

  // 🌐 Dev server fijo (Tauri lo espera en localhost:5173)
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: 'ws', host, port: 1421 }
      : undefined,
    watch: {
      // No mires cambios en el backend Rust/C++
      ignored: ['**/src-tauri/**'],
    },
  },

  // Prefijos de vars de entorno visibles al frontend
  envPrefix: ['VITE_', 'TAURI_'],

  // ═══════════════════════════════════════════════════════════════
  // 🗺️ ALIAS DE MÓDULOS
  // ═══════════════════════════════════════════════════════════════
  resolve: {
    alias: {
      '@':         path.resolve(__dirname, './src'),
      '@app':      path.resolve(__dirname, './src/app'),
      '@assets':   path.resolve(__dirname, './src/assets'),
      '@audio':    path.resolve(__dirname, './src/audio'),
      '@state':    path.resolve(__dirname, './src/state'),
      '@domain':   path.resolve(__dirname, './src/domain'),
      '@features': path.resolve(__dirname, './src/features'),
      '@services': path.resolve(__dirname, './src/services'),
      '@shared':   path.resolve(__dirname, './src/shared'),
      '@workers':  path.resolve(__dirname, './src/workers'),
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // 👷 WEB WORKERS
  // ═══════════════════════════════════════════════════════════════
  worker: {
    format: 'es',
  },

  // ═══════════════════════════════════════════════════════════════
  // 🚫 OPTIMIZE DEPS — AudioWorklets fuera del pre-bundle
  // ═══════════════════════════════════════════════════════════════
  optimizeDeps: {
    exclude: ['@audio/worklets/processors/MeterProcessor'],
  },

  // ═══════════════════════════════════════════════════════════════
  // 🏗️ BUILD
  // ═══════════════════════════════════════════════════════════════
  build: {
    // Tauri usa Chromium/WebView2 modernos → target alto = mejor performance
    target: process.env.TAURI_ENV_PLATFORM === 'windows'
      ? 'chrome110'
      : 'es2022',

    // No minificar en modo debug (mejor stack traces)
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,

    // Source maps en debug
    sourcemap: !!process.env.TAURI_ENV_DEBUG,

    // ⚠️ rolldownOptions (no rollupOptions) porque Vite 8 usa Rolldown.
    rolldownOptions: {
      output: {
        manualChunks,
      },
    },
  },
});