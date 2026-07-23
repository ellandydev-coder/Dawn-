// src/App.tsx

import './App.css';
import '@app/layouts/DAWLayout.css';
import '@features/splash/Splash.css';

import { useEffect, useRef, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { appConfig } from '@app/config/appConfig';
import { audioEngine } from '@audio/engine/AudioEngine';
import { StoreAudioBridge } from '@state/bridges/StoreAudioBridge';
import { store, useAppDispatch, useAppSelector } from '@state/store';
import {
  selectClipPropertiesModalId,
  selectOpenFxChainWindows,
  selectShowPreferences,
  closeClipProperties,
} from '@state/slices/ui/uiSlice';
import { setSampleRate } from '@state/slices/project/projectSlice';
import { TopBar } from '@features/transport/components/TopBar';
import { WorkspaceToolbar } from '@features/timeline/components/WorkspaceToolbar';
import { Sidebar } from '@features/browser/components/Sidebar';
import { Workspace } from '@features/timeline/components/Workspace';
import { BottomBar } from '@features/transport/components/BottomBar';
import { MixerView } from '@features/mixer/components/MixerView';
import { ClipPropertiesModal } from '@features/clip-properties';
import { FxBrowserModal } from '@features/fx-browser/components/FxBrowserModal';
import { FxChainWindow } from '@features/fx-chain/components/FxChainWindow';
import { PreferencesWindow } from '@features/preferences/components/PreferencesWindow';
import { MeterDebug } from '@features/debug';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const bridgeRef = useRef<StoreAudioBridge | null>(null);

  const showMixer = useAppSelector((s) => s.ui.showMixer);
  const showDebug = useAppSelector((s) => s.ui.showDebug);

  // ══════════════════════════════════════════════════════════════
  // 🚀 INICIALIZACIÓN CON SPLASH CONFIGURABLE
  // ══════════════════════════════════════════════════════════════
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const { splashMinDuration, splashFixedDuration } = appConfig;
      const startTime = Date.now();

      try {
        if (splashFixedDuration) {
          // ── Duración FIJA: motor + delay en paralelo ──
          await Promise.all([
            audioEngine.init(),
            new Promise((resolve) => setTimeout(resolve, splashMinDuration)),
          ]);
        } else {
          // ── Duración MÍNIMA: esperar lo que falte ──
          await audioEngine.init();

          const elapsed = Date.now() - startTime;
          const remaining = splashMinDuration - elapsed;

          if (remaining > 0) {
            await new Promise((resolve) => setTimeout(resolve, remaining));
          }
        }

        if (cancelled) return;

        // Configurar store con sample rate real
        store.dispatch(setSampleRate(audioEngine.sampleRate));

        // Conectar bridge audio ↔ estado
        const bridge = new StoreAudioBridge(store);
        bridge.attach();
        bridgeRef.current = bridge;

        setIsReady(true);

        // Cerrar splash y mostrar ventana principal
        await invoke('show_main_window');
      } catch (err) {
        console.error('Error al iniciar el motor de audio:', err);
      }
    };

    init();

    return () => {
      cancelled = true;
      bridgeRef.current?.detach();
      audioEngine.dispose();
    };
  }, []);

  // ══════════════════════════════════════════════════════════════
  // 🔄 LOADING STATE (ventana main oculta durante esto)
  // ══════════════════════════════════════════════════════════════
  if (!isReady) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#0a0c12',
          color: '#555',
          fontSize: '0.8rem',
          letterSpacing: '2px',
        }}
      >
        Cargando…
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // 🎹 DAW PRINCIPAL
  // ══════════════════════════════════════════════════════════════
  return (
    <div className={`daw-bl ${showMixer ? 'with-mixer' : ''}`}>
      <TopBar />
      <WorkspaceToolbar />

      <div className="daw-bl-body">
        <Sidebar />
        <Workspace />
      </div>

      <BottomBar />

      {showMixer && (
        <div className="daw-mixer-wrap">
          <MixerView />
        </div>
      )}

      {showDebug && <DebugPanel />}

      <ClipPropertiesGlobalModal />
      <FxBrowserModal />
      <FxChainWindowsHost />
      <PreferencesWindowHost />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 🎛️ FX CHAIN WINDOWS HOST
// ═══════════════════════════════════════════════════════════════
function FxChainWindowsHost() {
  const openWindows = useAppSelector(selectOpenFxChainWindows);

  return (
    <>
      {openWindows.map((trackId, index) => (
        <FxChainWindow
          key={trackId}
          trackId={trackId}
          windowIndex={index}
        />
      ))}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// ⚙️ PREFERENCES WINDOW HOST
// ═══════════════════════════════════════════════════════════════
function PreferencesWindowHost() {
  const isOpen = useAppSelector(selectShowPreferences);
  if (!isOpen) return null;
  return <PreferencesWindow />;
}

// ═══════════════════════════════════════════════════════════════
// 🎚️ CLIP PROPERTIES GLOBAL MODAL
// ═══════════════════════════════════════════════════════════════
function ClipPropertiesGlobalModal() {
  const dispatch = useAppDispatch();
  const clipPropertiesModalId = useAppSelector(selectClipPropertiesModalId);

  const handleClose = useCallback(() => {
    dispatch(closeClipProperties());
  }, [dispatch]);

  return (
    <ClipPropertiesModal
      clipId={clipPropertiesModalId}
      onClose={handleClose}
    />
  );
}

// ═══════════════════════════════════════════════════════════════
// 📊 DEBUG PANEL
// ═══════════════════════════════════════════════════════════════
function DebugPanel() {
  const trackIds = useAppSelector((s) => s.tracks.allIds);
  const trackById = useAppSelector((s) => s.tracks.byId);

  return (
    <div
      style={{
        position: 'fixed',
        right: 12,
        top: 120,
        background: 'rgba(15, 15, 20, 0.94)',
        backdropFilter: 'blur(8px)',
        padding: 10,
        borderRadius: 8,
        zIndex: 9999,
        border: '1px solid #2a2a35',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        maxHeight: '70vh',
        overflow: 'auto',
      }}
    >
      <div
        style={{
          color: '#fff',
          fontSize: 11,
          fontWeight: 600,
          marginBottom: 8,
          letterSpacing: 1,
        }}
      >
        📊 METER DEBUG
        <span style={{ color: '#666', fontWeight: 400, marginLeft: 8 }}>
          ({trackIds.length} tracks)
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 320 }}>
        <MeterDebug id="master" label="MASTER" />
        {trackIds.map((id) => (
          <MeterDebug
            key={id}
            id={id}
            label={trackById[id]?.name ?? id}
          />
        ))}
      </div>
    </div>
  );
}