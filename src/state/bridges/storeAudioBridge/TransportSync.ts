// src/state/bridges/storeAudioBridge/TransportSync.ts

import type { TransportScheduler } from '@audio/scheduling/TransportScheduler';
import type { StoreAudioBridgeEmitter } from './StoreAudioBridgeEmitter';
import type { TransportSnapshot } from './types';

export type TransportSyncLog = (
  message: string,
  level?: 'info' | 'warn' | 'error'
) => void;

/**
 * Aplica diffs de transport → scheduler + eventos.
 * No lee el store; solo recibe snapshots ya calculados.
 */
export class TransportSync {
  private readonly _scheduler: TransportScheduler;
  private readonly _emitter: StoreAudioBridgeEmitter;
  private readonly _log: TransportSyncLog;

  constructor(
    scheduler: TransportScheduler,
    emitter: StoreAudioBridgeEmitter,
    log: TransportSyncLog
  ) {
    this._scheduler = scheduler;
    this._emitter = emitter;
    this._log = log;
  }

  /**
   * Compara prev/next y aplica solo lo que cambió.
   * @returns true si hubo algún cambio relevante
   */
  public applyDiff(prev: TransportSnapshot, next: TransportSnapshot): boolean {
    let changed = false;

    if (
      next.isPlaying !== prev.isPlaying ||
      next.isRecording !== prev.isRecording
    ) {
      this.handleTransportChange(next.isPlaying, next.isRecording);
      changed = true;
    }

    if (next.editCursorSeconds !== prev.editCursorSeconds) {
      this.handleSeek(next.editCursorSeconds, next.isPlaying);
      changed = true;
    }

    if (
      next.loopEnabled !== prev.loopEnabled ||
      next.loopStart !== prev.loopStart ||
      next.loopEnd !== prev.loopEnd
    ) {
      this.handleLoopChange(next.loopEnabled, next.loopStart, next.loopEnd);
      changed = true;
    }

    return changed;
  }

  public handleTransportChange(
    isPlaying: boolean,
    isRecording: boolean
  ): void {
    if (isPlaying || isRecording) {
      this._scheduler.start();
    } else {
      this._scheduler.stop();
    }

    this._emitter.emit({ type: 'transportChanged', isPlaying, isRecording });

    const status = isRecording
      ? 'recording'
      : isPlaying
        ? 'playing'
        : 'stopped';
    this._log(`Transport → ${status}`);
  }

  public handleSeek(editCursorSeconds: number, isPlaying: boolean): void {
    // Solo seek al scheduler si está reproduciendo.
    if (!isPlaying) return;

    this._scheduler.seekTo(editCursorSeconds);
    this._emitter.emit({ type: 'seekApplied', toSec: editCursorSeconds });
    this._log(`Seek → ${editCursorSeconds.toFixed(3)}s`);
  }

  public handleLoopChange(
    enabled: boolean,
    start: number,
    end: number
  ): void {
    this._emitter.emit({ type: 'loopChanged', enabled, start, end });
    this._log(
      enabled
        ? `Loop ON: ${start.toFixed(2)}s → ${end.toFixed(2)}s`
        : 'Loop OFF'
    );
  }

  public stopScheduler(): void {
    this._scheduler.stop();
  }
}