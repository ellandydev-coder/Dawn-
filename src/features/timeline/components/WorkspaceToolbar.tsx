import { useState } from 'react';
import { Icon } from '@shared/components/Icon';

import './WorkspaceToolbar.css';

/**
 * WorkspaceToolbar (estilo REAPER)
 * ---------------------------------
 * Barra de herramientas en 2 filas replicando REAPER real.
 *
 * FILA 1 (8 iconos): Archivo · Edición · Metrónomo · Time selection
 * FILA 2 (9 iconos): Cortar · Link · Grid · Envolvente · Snap · Loop · Lock · Bypass
 *
 * Por ahora solo UI + console.log (sin lógica real).
 */
export function WorkspaceToolbar() {
  // Estados de toggle (solo visuales por ahora)
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [snapOn, setSnapOn] = useState(true);
  const [loopOn, setLoopOn] = useState(false);
  const [lockOn, setLockOn] = useState(false);
  const [linkOn, setLinkOn] = useState(false);
  const [envelopeOn, setEnvelopeOn] = useState(false);

  const log = (action: string) => () => console.log(`[Toolbar] ${action}`);
  const ICON_SIZE = 14;

  return (
    <div className="ws-toolbar">
      {/* ═══════════════════════════════════════════════
          FILA 1: Archivo / Edición / Metrónomo
          ═══════════════════════════════════════════════ */}
      <div className="ws-toolbar-row">
        <button className="ws-tb-btn" title="Nuevo proyecto" onClick={log('new')}>
          <Icon name="new-project" size={ICON_SIZE} />
        </button>
        <button className="ws-tb-btn" title="Abrir proyecto" onClick={log('open')}>
          <Icon name="open-project" size={ICON_SIZE} />
        </button>
        <button className="ws-tb-btn" title="Guardar proyecto" onClick={log('save')}>
          <Icon name="save-project" size={ICON_SIZE} />
        </button>
        <button className="ws-tb-btn" title="Información del proyecto" onClick={log('info')}>
          <Icon name="info" size={ICON_SIZE} />
        </button>

        <div className="ws-tb-sep" />

        <button className="ws-tb-btn" title="Deshacer (Ctrl+Z)" onClick={log('undo')}>
          <Icon name="undo" size={ICON_SIZE} />
        </button>
        <button className="ws-tb-btn" title="Rehacer (Ctrl+Shift+Z)" onClick={log('redo')}>
          <Icon name="redo" size={ICON_SIZE} />
        </button>

        <div className="ws-tb-sep" />

        <button
          className={`ws-tb-btn ${metronomeOn ? 'is-active' : ''}`}
          title="Metrónomo"
          onClick={() => { setMetronomeOn((v) => !v); log('metronome')(); }}
        >
          <Icon name="metronome" size={ICON_SIZE} />
        </button>
        <button className="ws-tb-btn" title="Selección de tiempo" onClick={log('time-selection')}>
          <Icon name="time-selection" size={ICON_SIZE} />
        </button>
      </div>

      {/* ═══════════════════════════════════════════════
          FILA 2: Cortar / Link / Grid / Snap / Loop / Lock
          ═══════════════════════════════════════════════ */}
      <div className="ws-toolbar-row">
        <button className="ws-tb-btn" title="Cortar / Slice" onClick={log('scissors')}>
          <Icon name="scissors" size={ICON_SIZE} />
        </button>
        <button
          className={`ws-tb-btn ${linkOn ? 'is-active' : ''}`}
          title="Enlazar / Ripple editing"
          onClick={() => { setLinkOn((v) => !v); log('link')(); }}
        >
          <Icon name="link" size={ICON_SIZE} />
        </button>

        <div className="ws-tb-sep" />

        <button className="ws-tb-btn" title="Configuración de grid" onClick={log('grid-settings')}>
          <Icon name="grid-settings" size={ICON_SIZE} />
        </button>
        <button
          className={`ws-tb-btn ${envelopeOn ? 'is-active' : ''}`}
          title="Envolventes / Automatización"
          onClick={() => { setEnvelopeOn((v) => !v); log('envelope')(); }}
        >
          <Icon name="envelope" size={ICON_SIZE} />
        </button>
        <button className="ws-tb-btn" title="Visibilidad de grid" onClick={log('grid-visibility')}>
          <Icon name="grid-visibility" size={ICON_SIZE} />
        </button>

        <div className="ws-tb-sep" />

        <button
          className={`ws-tb-btn ${snapOn ? 'is-active' : ''}`}
          title="Snap a la grid"
          onClick={() => { setSnapOn((v) => !v); log('snap')(); }}
        >
          <Icon name="snap" size={ICON_SIZE} />
        </button>

        <div className="ws-tb-sep" />

        <button
          className={`ws-tb-btn ${loopOn ? 'is-active' : ''}`}
          title="Loop / Repetir"
          onClick={() => { setLoopOn((v) => !v); log('loop')(); }}
        >
          <Icon name="loop" size={ICON_SIZE} />
        </button>
        <button
          className={`ws-tb-btn ${lockOn ? 'is-active' : ''}`}
          title="Bloquear items"
          onClick={() => { setLockOn((v) => !v); log('lock')(); }}
        >
          <Icon name="lock" size={ICON_SIZE} />
        </button>
        <button className="ws-tb-btn" title="Bypass automatización" onClick={log('bypass')}>
          <Icon name="bypass" size={ICON_SIZE} />
        </button>
      </div>
    </div>
  );
}