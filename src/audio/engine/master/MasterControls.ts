// src/audio/engine/master/MasterControls.ts

import type { MasterBus } from '@audio/graph/MasterBus';
import type { AudioEngineEmitter } from '../AudioEngineEmitter';

/**
 * Control de master: volume, mute, panic, limiter, headroom.
 * No conoce el ciclo de vida del engine; solo opera sobre MasterBus (+ estado local).
 */
export class MasterControls {
  private _volume: number;
  private _muted: boolean;
  private _masterBus: MasterBus | null = null;
  private readonly _emitter: AudioEngineEmitter;

  constructor(
    initialVolume: number,
    initialMuted: boolean,
    emitter: AudioEngineEmitter
  ) {
    this._emitter = emitter;
    this._volume = this.clampVolume(initialVolume);
    this._muted = initialMuted;
  }

  /** Llamado cuando el MasterBus ya existe (post-init). */
  public attach(masterBus: MasterBus): void {
    this._masterBus = masterBus;
  }

  public detach(): void {
    this._masterBus = null;
  }

  public setVolume(value: number): void {
    const clamped = this.clampVolume(value);
    if (clamped === this._volume) return;

    this._volume = clamped;
    this._masterBus?.setVolume(clamped);
    this._emitter.emit({ type: 'volumeChanged', volume: clamped });
  }

  public getVolume(): number {
    return this._volume;
  }

  public setMuted(muted: boolean): void {
    if (this._muted === muted) return;
    this._muted = muted;
    this._masterBus?.setMuted(muted);
    this._emitter.emit({ type: 'muteChanged', muted });
  }

  public isMuted(): boolean {
    return this._muted;
  }

  public panic(): void {
    if (!this._masterBus) return;
    this._masterBus.panic();
    this._muted = true;
    this._emitter.emit({ type: 'muteChanged', muted: true });
  }

  public setLimiterEnabled(enabled: boolean): void {
    this._masterBus?.setLimiterEnabled(enabled);
  }

  public isLimiterEnabled(): boolean {
    return this._masterBus?.isLimiterEnabled() ?? false;
  }

  public setHeadroom(db: number): void {
    this._masterBus?.setHeadroom(db);
  }

  public getHeadroom(): number {
    return this._masterBus?.getHeadroom() ?? 0;
  }

  public getGainReductionDb(): number {
    return this._masterBus?.getGainReductionDb() ?? 0;
  }

  public resetLocal(volume: number, muted: boolean): void {
    this._volume = this.clampVolume(volume);
    this._muted = muted;
  }

  private clampVolume(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
  }
}