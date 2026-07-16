// src/features/preferences/components/PreferencesWindow.tsx

import { memo, useCallback, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@state/store';
import {
  closePreferences,
  setSelectedPreference,
  selectSelectedPreferenceId,
} from '@state/slices/ui/uiSlice';
import { FloatingWindow } from '@shared/components/FloatingWindow';
import { getDefaultCategoryId } from '../data/preferencesCatalog';
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
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

/**
 * PreferencesWindow
 * -----------------
 * Ventana flotante de Preferences (estilo REAPER Preferences).
 *
 * Este componente asume que ya está "abierto" (el host lo renderiza
 * condicionalmente basado en `showPreferences` del store).
 *
 * Estructura:
 *   ┌───────────────────────────────────────────────────────┐
 *   │ Preferences                              [📌] [×]     │  ← FloatingWindow
 *   ├──────────────────┬────────────────────────────────────┤
 *   │ General          │                                    │
 *   │   Startup        │                                    │
 *   │ Audio            │   PreferencesContent               │
 *   │   Device         │   (panel de la categoría activa)   │
 *   │ ▶ Appearance     │                                    │
 *   │ ...              │                                    │
 *   └──────────────────┴────────────────────────────────────┘
 *
 * La categoría seleccionada persiste en Redux → sobrevive
 * al cerrar/reabrir la ventana durante la sesión.
 */
function PreferencesWindowBase() {
  const dispatch = useAppDispatch();
  const selectedId = useAppSelector(selectSelectedPreferenceId);

  // ─── Selección inicial (primera vez que se abre) ────────────

  /*
   * Si el usuario nunca ha abierto Preferences, `selectedId` es null.
   * Aplicamos el default del catálogo la primera vez.
   *
   * Este useEffect es idempotente: solo dispara la acción cuando
   * realmente no hay selección previa. En cargas posteriores no hace nada.
   */
  useEffect(() => {
    if (selectedId === null) {
      dispatch(setSelectedPreference(getDefaultCategoryId()));
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

  // Mientras se resuelve el default (1 tick), evitamos renderizar
  // el content con un id vacío. La ventana ya tiene su chrome montado
  // via FloatingWindow, así que el flash es imperceptible.
  const effectiveId = selectedId ?? getDefaultCategoryId();

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