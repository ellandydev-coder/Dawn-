// src/App.tsx

// 🎨 CSS
import './App.css';
import '@app/layouts/DAWLayout.css';
import '@features/splash/Splash.css';

import { useEffect, useRef, useState, useCallback } from 'react';
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
import { ControlSurfaceIcon } from '@shared/components/icons/branding/ControlSurfaceIcon';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const bridgeRef = useRef<StoreAudioBridge | null>(null);

  const showMixer = useAppSelector((s) => s.ui.showMixer);
  const showDebug = useAppSelector((s) => s.ui.showDebug);

  const handleStart = async () => {
    await audioEngine.init();
    store.dispatch(setSampleRate(audioEngine.sampleRate));
    const bridge = new StoreAudioBridge(store);
    bridge.attach();
    bridgeRef.current = bridge;
    setIsReady(true);
  };

  useEffect(() => {
    return () => {
      bridgeRef.current?.detach();
      audioEngine.dispose();
    };
  }, []);

  if (!isReady) {
    return (
      <div className="splash">
        <div className="splash-card">
          <div className="splash-logo">
            <ControlSurfaceIcon size={96} title="Web DAW" />
          </div>
          <h1>WEB DAW</h1>
          <p>Estación de audio digital para tu navegador</p>
          <button className="splash-start" onClick={handleStart}>
            Iniciar motor de audio
          </button>
          <div className="splash-hint">
            El navegador requiere una interacción para activar el audio.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`daw-bl ${showMixer ? 'with-mixer' : ''}`}>
      <TopBar />

      {/* 🧰 Toolbar REAPER — ocupa TODO el ancho */}
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

      {/* ══════════════════════════════════════════════════════
          🎚️ MODAL DE PROPIEDADES DEL CLIP (global)
          ══════════════════════════════════════════════════════ */}
      <ClipPropertiesGlobalModal />

      {/* ══════════════════════════════════════════════════════
          🎛️ FX BROWSER MODAL (global)
          ══════════════════════════════════════════════════════ */}
      <FxBrowserModal />

      {/* ══════════════════════════════════════════════════════
          🎛️ FX CHAIN WINDOWS (flotantes, múltiples)
          -------------------------------------------------------
          Una ventana por cada trackId en openFxChainWindows[].
          Cada una es independiente, arrastrable, no bloquea la UI.
          Se abren vía dispatch(openFxChainWindow(trackId)) /
          dispatch(toggleFxChainWindow(trackId)).
          ══════════════════════════════════════════════════════ */}
      <FxChainWindowsHost />

      {/* ══════════════════════════════════════════════════════
          ⚙️ PREFERENCES WINDOW (flotante, singleton)
          -------------------------------------------------------
          Solo hay una instancia. Se abre desde el botón ☰ del
          TopBar via dispatch(togglePreferences()).
          ══════════════════════════════════════════════════════ */}
      <PreferencesWindowHost />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 🎛️ FX CHAIN WINDOWS HOST
// ═══════════════════════════════════════════════════════════════

/**
 * FxChainWindowsHost
 * ------------------
 * Renderiza N ventanas FX Chain (una por track abierta).
 * Aislado del App para que sus re-renders no invaliden el resto.
 *
 * windowIndex escala la posición inicial para que las ventanas
 * no se apilen exactamente una encima de la otra.
 */
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

/**
 * PreferencesWindowHost
 * ---------------------
 * Renderiza (o no) la ventana singleton de Preferences según el
 * flag `showPreferences` del store. Aislado del App para que sus
 * re-renders no invaliden el resto del árbol.
 */
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
