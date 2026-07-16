/**
 * AppProviders.tsx
 * ----------------
 * Punto único de montaje de:
 *  - Redux Provider
 *  - ShortcutManager (start + registro global)
 *  - ShortcutsOverlay (modal F1)
 *
 * Envuelve toda la app.
 */

import { useEffect, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { store } from '@state/store';
import { shortcutManager } from '@services/shortcuts/ShortcutManager';
import { registerGlobalShortcuts } from '@app/config/keyboardShortcuts';
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
 * Componente interno: arranca el ShortcutManager y registra los atajos globales.
 * Debe estar DENTRO del <Provider> para poder acceder al store.
 */
function ShortcutsBootstrap() {
  useEffect(() => {
    shortcutManager.start();
    const unregister = registerGlobalShortcuts(store);

    if (import.meta.env.DEV) {
      console.info(
        '%c⌨ Shortcuts activos. Prueba: window.__shortcuts.help()',
        'color:#4ade80'
      );
    }

    return () => {
      unregister();
      shortcutManager.stop();
    };
  }, []);

  return null;
}