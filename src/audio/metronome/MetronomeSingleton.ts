// src/audio/metronome/MetronomeSingleton.ts
// ═══════════════════════════════════════════════════════════════
// 🎯 METRÓNOMO — lazy singleton encapsulado
// --------------------------------------------------------------
// • Testeable (se puede resetear con .dispose())
// • Sin mutación de variables de módulo
// • Se re-crea automáticamente si cambia el AudioContext (HMR)
// ═══════════════════════════════════════════════════════════════

import { audioEngine } from '@audio/engine/AudioEngine';
import { MetronomeEngine } from '@audio/scheduling/MetronomeEngine';

const LOG_PREFIX = '[MetronomeSingleton]';
const VERBOSE = Boolean(import.meta.env?.DEV);

function log(
  message: string,
  level: 'info' | 'warn' | 'error' = 'info'
): void {
  if (!VERBOSE && level === 'info') return;

  switch (level) {
    case 'error':
      console.error(LOG_PREFIX, message);
      break;
    case 'warn':
      console.warn(LOG_PREFIX, message);
      break;
    default:
      console.info(LOG_PREFIX, message);
      break;
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

class MetronomeSingleton {
  private _instance: MetronomeEngine | null = null;
  private _context: AudioContext | null = null;

  /** Obtiene la instancia, creándola o re-creándola si es necesario */
  public get(): MetronomeEngine | null {
    if (!audioEngine.isInitialized) return null;

    // Si el contexto cambió (HMR, restart del engine), recrear
    if (this._instance && this._context !== audioEngine.context) {
      this.dispose();
    }

    if (!this._instance) {
      this._instance = new MetronomeEngine(
        audioEngine.context,
        audioEngine.master
      );
      this._context = audioEngine.context;
      log('Metronome singleton creado');
    }

    return this._instance;
  }

  /** Referencia sin lazy init (para setters que no deben crear el metrónomo) */
  public peek(): MetronomeEngine | null {
    return this._instance;
  }

  public dispose(): void {
    if (this._instance) {
      try {
        this._instance.dispose();
      } catch (err) {
        log(`Error al disponer metrónomo: ${errMsg(err)}`, 'warn');
      }
      log('Metronome singleton destruido');
    }

    this._instance = null;
    this._context = null;
  }
}

export const metronome = new MetronomeSingleton();

/** @deprecated Usa `metronome.get()` — mantiene compat con la API anterior */
export function getMetronome(): MetronomeEngine | null {
  return metronome.get();
}

/** @deprecated Usa el ciclo de vida del AudioProvider */
export function disposeMetronome(): void {
  metronome.dispose();
}