// src/app/providers/AppProviders.tsx

import { useEffect, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { store } from '@state/store';
import { shortcutManager } from '@services/shortcuts/ShortcutManager';
import { bootstrapShortcuts } from '@services/shortcuts/registry';
import { registration as appShortcuts } from '@app/config/shortcuts';
import { ShortcutsOverlay } from '@features/shortcuts';
import { startPluginScan } from '@services/plugins/pluginScanner.thunks';

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <Provider store={store}>
      <ShortcutsBootstrap />
      <PluginScanBootstrap />
      {children}
      <ShortcutsOverlay />
    </Provider>
  );
}

function ShortcutsBootstrap() {
  useEffect(() => {
    shortcutManager.start();
    const cleanup = bootstrapShortcuts(store, [appShortcuts]);
    return () => {
      cleanup();
      shortcutManager.stop();
    };
  }, []);
  return null;
}

/**
 * Lanza el escaneo de plugins una única vez al montar la app,
 * si `scanOnStartup` está activo en las preferencias VST.
 * En StrictMode DEV React monta dos veces → early-return del thunk
 * lo hace idempotente (ya comprueba `isScanning`).
 */
function PluginScanBootstrap() {
  useEffect(() => {
    const { preferences, pluginScan } = store.getState();
    if (!preferences.vst.scanOnStartup) return;
    if (pluginScan.isScanning) return;
    if (pluginScan.foundIds.length > 0) return; // ya se escaneó
    store.dispatch(startPluginScan());
  }, []);
  return null;
}