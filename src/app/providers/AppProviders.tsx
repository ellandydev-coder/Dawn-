// src/app/providers/AppProviders.tsx
//
// Punto único de montaje de:
//  - Redux Provider
//  - ShortcutManager (start + bootstrap distribuido)
//  - ShortcutsOverlay (modal F1)

import { useEffect, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { store } from '@state/store';
import { shortcutManager } from '@services/shortcuts/ShortcutManager';
import { bootstrapShortcuts } from '@services/shortcuts/registry';
import { registration as appShortcuts } from '@app/config/shortcuts';
import { ShortcutsOverlay } from '@features/shortcuts';

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <Provider store={store}>
      <ShortcutsBootstrap />
      {children}
      <ShortcutsOverlay />
    </Provider>
  );
}

/**
 * Componente interno: arranca el ShortcutManager y registra
 * todos los atajos via el sistema distribuido.
 * Debe estar DENTRO del <Provider> para acceder al store.
 */
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