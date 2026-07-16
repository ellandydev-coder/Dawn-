// src/features/preferences/panels/vst/VstPanel.tsx

import { memo, useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '@state/store';
import {
  patchVst,
  selectVstPreferences,
} from '@state/slices/preferences/preferencesSlice';
import {
  VST_KNOB_MODES,
  VST_AUTOMATION_NOTIFICATION_MODES,
  KNOB_MODE_LABELS,
  AUTOMATION_NOTIFICATION_LABELS,
  type VstPreferences,
  type VstKnobMode,
  type VstAutomationNotificationMode,
} from '@domain/models/preferences/VstPreferences';
import type { PreferencePanelComponentProps } from '@features/preferences/registry';
import { PrefCheckbox } from '../../components/controls/PrefCheckbox';
import { PrefSelect } from '../../components/controls/PrefSelect';
import { PrefTextField } from '../../components/controls/PrefTextField';
import { PrefSection } from '../../components/controls/PrefSection';

import '../../components/controls/controls.css';
import './VstPanel.css';

// ═══════════════════════════════════════════════════════════════
// 🛠️ HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Genera un patcher tipado y estable para una key concreta.
 * Evita crear un callback nuevo en cada render por cada checkbox.
 */
function useVstPatcher<K extends keyof VstPreferences>(
  key: K
): (value: VstPreferences[K]) => void {
  const dispatch = useAppDispatch();

  return useCallback(
    (value: VstPreferences[K]) => {
      dispatch(patchVst({ [key]: value } as Partial<VstPreferences>));
    },
    [dispatch, key]
  );
}

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

/**
 * VstPanel
 * --------
 * Panel real del setting VST (Preferences → Plug-ins → VST).
 *
 * Recibe `panelId` del registry (contrato PreferencePanelComponentProps).
 * Por ahora no lo usa activamente, pero está disponible para telemetría
 * o para dispatch de acciones genéricas del slice.
 */
function VstPanelBase(_props: PreferencePanelComponentProps) {
  // ─── Store ──────────────────────────────────────────────────

  const prefs = useAppSelector(selectVstPreferences);

  // ─── Patchers atómicos (uno por setting) ────────────────────

  const setPluginPaths            = useVstPatcher('pluginPaths');
  const setScanOnStartup          = useVstPatcher('scanOnStartup');
  const setUseGenericUi           = useVstPatcher('useGenericUi');
  const setKnobMode               = useVstPatcher('knobMode');
  const setAutomationNotifications = useVstPatcher('automationNotifications');
  const setDontFlushSynthesizers  = useVstPatcher('dontFlushSynthesizers');
  const setDontSendNoteOffs       = useVstPatcher('dontSendNoteOffs');
  const setInformOfflineRendering = useVstPatcher('informOfflineRendering');
  const setBypassOnConfigOpen     = useVstPatcher('bypassOnConfigOpen');
  const setUad1SyncMode           = useVstPatcher('uad1SyncMode');
  const setAllowCompleteUnload    = useVstPatcher('allowCompleteUnload');

  // ─── Handlers de botones de acción (placeholders) ───────────

  const handleRescan = useCallback(() => {
    console.info('[VST] Rescan plugins requested (TODO)');
  }, []);

  const handleEditPathList = useCallback(() => {
    console.info('[VST] Edit path list requested (TODO)');
  }, []);

  // ─── Opciones de los selects (memoizadas) ───────────────────

  const knobModeOptions = useMemo(
    () =>
      VST_KNOB_MODES.map((mode: VstKnobMode) => ({
        value: mode,
        label: KNOB_MODE_LABELS[mode],
      })),
    []
  );

  const automationNotificationOptions = useMemo(
    () =>
      VST_AUTOMATION_NOTIFICATION_MODES.map(
        (mode: VstAutomationNotificationMode) => ({
          value: mode,
          label: AUTOMATION_NOTIFICATION_LABELS[mode],
        })
      ),
    []
  );

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="prefs-panel vst-panel">
      {/* Cabecera del panel */}
      <div className="prefs-panel__header">
        <h2 className="prefs-panel__title">VST plug-ins settings</h2>
        <p className="prefs-panel__subtitle">
          Configuración de plugins VST y VST3
        </p>
      </div>

      {/* Cuerpo */}
      <div className="prefs-panel__body">

        {/* ── Sección 1: Paths & escaneo ─────────────────── */}
        <PrefSection title="Plug-in paths & scanning">
          <PrefTextField
            label="VST plug-in paths (can be multiple paths separated by semicolons):"
            value={prefs.pluginPaths}
            onChange={setPluginPaths}
            monospace
            placeholder="C:\Program Files\VstPlugins;C:\Program Files\Common Files\VST3"
          />

          <div className="vst-panel__actions-row">
            <button
              type="button"
              className="vst-panel__btn"
              onClick={handleRescan}
              title="Escanear plugins ahora"
            >
              Re-scan…
            </button>

            <PrefCheckbox
              label="Scan new/updated plug-ins on startup"
              checked={prefs.scanOnStartup}
              onChange={setScanOnStartup}
            />

            <div className="vst-panel__spacer" />

            <button
              type="button"
              className="vst-panel__btn"
              onClick={handleEditPathList}
              title="Editor multi-línea para paths"
            >
              Edit path list…
            </button>
          </div>

          <p className="vst-panel__note">
            If multiple VSTs are scanned with the same dll name, only one will
            be available: either the plug-in found later in the path list, or
            highest in the directory structure for a given path.
          </p>
        </PrefSection>

        {/* ── Sección 2: UI del plugin ───────────────────── */}
        <PrefSection title="Plug-in UI">
          <div className="vst-panel__inline-row">
            <PrefCheckbox
              label="Default VST to generic UI (instead of plug-in UI)"
              checked={prefs.useGenericUi}
              onChange={setUseGenericUi}
            />

            <div className="vst-panel__spacer" />

            <PrefSelect<VstKnobMode>
              label="Knob mode:"
              value={prefs.knobMode}
              options={knobModeOptions}
              onChange={setKnobMode}
              width={140}
            />
          </div>
        </PrefSection>

        {/* ── Sección 3: Compatibility ───────────────────── */}
        <PrefSection title="VST compatibility">
          <PrefSelect<VstAutomationNotificationMode>
            label="Parameter automation notifications:"
            value={prefs.automationNotifications}
            options={automationNotificationOptions}
            onChange={setAutomationNotifications}
            width={340}
          />

          <PrefCheckbox
            label="Don't flush synthesizer plug-ins on stop/reset"
            checked={prefs.dontFlushSynthesizers}
            onChange={setDontFlushSynthesizers}
          />

          <PrefCheckbox
            label="Don't send note-offs or pitch reset messages on stop/reset"
            checked={prefs.dontSendNoteOffs}
            onChange={setDontSendNoteOffs}
          />

          <PrefCheckbox
            label="Inform plug-ins of offline rendering state"
            checked={prefs.informOfflineRendering}
            onChange={setInformOfflineRendering}
          />

          <PrefCheckbox
            label="Bypass audio while opening plug-in config window (good for some non-threadsafe VSTs)"
            checked={prefs.bypassOnConfigOpen}
            onChange={setBypassOnConfigOpen}
          />

          <PrefCheckbox
            label="UAD-1 synchronous mode (reduces CPU munch) - requires anticipative FX disabled"
            checked={prefs.uad1SyncMode}
            onChange={setUad1SyncMode}
          />

          <PrefCheckbox
            label="Allow complete unload of VST plug-ins (reduces memory use, but may not be compatible)"
            checked={prefs.allowCompleteUnload}
            onChange={setAllowCompleteUnload}
          />
        </PrefSection>

      </div>
    </div>
  );
}

export const VstPanel = memo(VstPanelBase);