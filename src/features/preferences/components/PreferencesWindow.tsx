// src/features/preferences/components/PreferencesWindow.tsx

import { memo, useCallback, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@state/store';
import {
  closePreferences,
  setSelectedPreference,
  selectSelectedPreferenceId,
} from '@state/slices/ui/uiSlice';
import { FloatingWindow } from '@shared/components/FloatingWindow';
import { preferencesRegistry } from '@features/preferences/registry';
import { PreferencesSidebar } from './PreferencesSidebar';
import { PreferencesContent } from './PreferencesContent';

import './PreferencesWindow.css';

// ═══════════════════════════════════════════════════════════════
// 🎯 CONSTANTES
// ═══════════════════════════════════════════════════════════════

const WINDOW_INITIAL_X = 160;
const WINDOW_INITIAL_Y = 90;
const WINDOW_WIDTH = 820;
const WINDOW_MIN_HEIGHT = 520;

// ═══════════════════════════════════════════════════════════════
// 🛠️ HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Devuelve el ID de la primera entry del registry (según orden).
 * Fallback vacío si por alguna razón el registry está vacío.
 */
function getFirstPreferenceId(): string {
  const first = preferencesRegistry.getAll()[0];
  return first?.id ?? '';
}

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

/**
 * PreferencesWindow
 * -----------------
 * Ventana flotante de Preferences (estilo REAPER Preferences).
 *
 * Fuente de datos:
 *   • `preferencesRegistry` — descubierto en el bootstrap via Vite glob
 *   • `selectedPreferenceId` (Redux) — persiste entre aperturas
 *
 * Estructura visual:
 *   ┌───────────────────────────────────────────────────────┐
 *   │ Preferences                              [📌] [×]     │
 *   ├──────────────────┬────────────────────────────────────┤
 *   │ Sidebar (tree)   │  Content (component o placeholder) │
 *   └──────────────────┴────────────────────────────────────┘
 */
function PreferencesWindowBase() {
  const dispatch = useAppDispatch();
  const selectedId = useAppSelector(selectSelectedPreferenceId);

  // ─── Selección inicial ──────────────────────────────────────
  /*
   * Si el usuario nunca ha abierto Preferences, selectedId es null.
   * Aplicamos el primer id del registry como default.
   *
   * Idempotente: solo dispara la acción cuando realmente no hay
   * selección previa.
   */
  useEffect(() => {
    if (selectedId === null) {
      dispatch(setSelectedPreference(getFirstPreferenceId()));
    }
  }, [selectedId, dispatch]);

  // ─── Handlers ───────────────────────────────────────────────

  const handleClose = useCallback(() => {
    dispatch(closePreferences());
  }, [dispatch]);

  const handleSelectCategory = useCallback(
    (id: string) => {
      dispatch(setSelectedPreference(id));
    },
    [dispatch]
  );

  // ─── Render ─────────────────────────────────────────────────

  const effectiveId = selectedId ?? getFirstPreferenceId();

  return (
    <FloatingWindow
      title="Preferences"
      onClose={handleClose}
      initialX={WINDOW_INITIAL_X}
      initialY={WINDOW_INITIAL_Y}
      width={WINDOW_WIDTH}
      minHeight={WINDOW_MIN_HEIGHT}
      className="prefs-window"
      ariaLabel="Preferences window"
    >
      <PreferencesSidebar
        selectedId={effectiveId}
        onSelect={handleSelectCategory}
      />
      <PreferencesContent selectedId={effectiveId} />
    </FloatingWindow>
  );
}

export const PreferencesWindow = memo(PreferencesWindowBase);