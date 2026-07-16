/**
 * ShortcutsOverlay.tsx
 * --------------------
 * Modal cheatsheet con todos los atajos disponibles.
 * Se abre con F1 o Shift+? y se cierra con Esc.
 */

import { useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '@state/store';
import { setShortcutsOverlay } from '@state/slices/ui/uiSlice';
import { shortcutManager } from '@services/shortcuts/ShortcutManager';
import './ShortcutsOverlay.css';

export function ShortcutsOverlay() {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector((s) => s.ui.showShortcutsOverlay);

  const grouped = useMemo(() => {
    if (!isOpen) return {};
    return shortcutManager.listByCategory();
  }, [isOpen]);

  if (!isOpen) return null;

  const close = () => dispatch(setShortcutsOverlay(false));

  return (
    <div className="shortcuts-overlay" onClick={close}>
      <div
        className="shortcuts-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="shortcuts-header">
          <h2>⌨ Atajos de teclado</h2>
          <button className="shortcuts-close" onClick={close} aria-label="Cerrar">
            ✕
          </button>
        </header>

        <div className="shortcuts-body">
          {Object.entries(grouped).map(([category, items]) => (
            <section key={category} className="shortcuts-section">
              <h3>{category}</h3>
              <ul>
                {items.map((sc, i) => (
                  <li key={`${sc.keys}-${i}`}>
                    <span className="shortcut-desc">{sc.description}</span>
                    <span className="shortcut-keys">
                      {formatKeys(sc.keys)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <footer className="shortcuts-footer">
          Pulsa <kbd>Esc</kbd> para cerrar
        </footer>
      </div>
    </div>
  );
}

/** "ctrl+shift+m" -> <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd> */
function formatKeys(keys: string) {
  const parts = keys.split('+').map((p) => {
    if (p === 'ctrl') return 'Ctrl';
    if (p === 'shift') return 'Shift';
    if (p === 'alt') return 'Alt';
    if (p === 'meta') return '⌘';
    if (p === 'space') return 'Space';
    if (p === 'esc') return 'Esc';
    if (p === 'enter') return '↵';
    if (p === 'home') return 'Home';
    if (p.length === 1) return p.toUpperCase();
    return p.charAt(0).toUpperCase() + p.slice(1);
  });

  return parts.map((p, i) => (
    <span key={i}>
      <kbd>{p}</kbd>
      {i < parts.length - 1 && <span className="kbd-plus">+</span>}
    </span>
  ));
}