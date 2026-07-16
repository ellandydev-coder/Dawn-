// src/audio/graph/BusMeter.ts

import { MeterManager } from '@audio/metering/MeterManager';
import { getBusErrorMessage } from './bus.types';

export interface BusMeterConfig {
  attach?: boolean;
  verbose?: boolean;
}

const DEFAULT_CONFIG: Required<BusMeterConfig> = {
  attach: true,
  verbose: import.meta.env?.DEV ?? false,
};

export class BusMeter {
  private readonly _id: string;
  private readonly _ctx: AudioContext;
  private readonly _config: Required<BusMeterConfig>;

  private _node: AudioWorkletNode | null = null;
  private _tapNode: AudioNode | null = null;

  constructor(id: string, ctx: AudioContext, config: BusMeterConfig = {}) {
    this._id = id;
    this._ctx = ctx;
    this._config = { ...DEFAULT_CONFIG, ...config };

        if (this._config.attach) {
      this._createMeter();
    }
  }

  public get node(): AudioWorkletNode | null {
    return this._node;
  }

  public connectToTap(tap: AudioNode): void {
    if (!this._node) return;
    if (this._tapNode === tap) return;

    this._disconnectFromTap();
    tap.connect(this._node);
    this._tapNode = tap;
  }

  public disconnectFromTap(): void {
    this._disconnectFromTap();
  }

  public dispose(): void {
    this._disconnectFromTap();

    if (!this._node) return;

        try {
      this._node.disconnect();
    } catch {
      /* ignore */
    }

    MeterManager.removeMeter(this._id);
    this._node = null;
  }

  private _createMeter(): void {
    try {
      this._node = MeterManager.createMeter(this._id, this._ctx);
    } catch (err) {
      this._log(`Meter no disponible: ${getBusErrorMessage(err)}`, 'warn');
      this._node = null;
    }
  }

  private _disconnectFromTap(): void {
    if (!this._node || !this._tapNode) {
      this._tapNode = null;
      return;
    }

        try {
      this._tapNode.disconnect(this._node);
    } catch {
      /* ignore */
    }

    this._tapNode = null;
  }

  private _log(msg: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    if (!this._config.verbose && level === 'info') return;

    const prefix = `[BusMeter:${this._id}]`;
    switch (level) {
      case 'error': console.error(prefix, msg); break;
      case 'warn': console.warn(prefix, msg); break;
      default: console.info(prefix, msg);
    }
  }
}