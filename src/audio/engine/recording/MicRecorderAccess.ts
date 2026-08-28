// src/audio/engine/recording/MicRecorderAccess.ts

import { MicRecorder } from '@audio/recording/MicRecorder';
import type { MasterBus } from '@audio/graph/MasterBus';
import type { AudioEngineState } from '../types';

export interface MicRecorderAccessDeps {
  getState: () => AudioEngineState;
  getContext: () => AudioContext;
  getMasterBus: () => MasterBus;
  verbose: boolean;
  log: (msg: string) => void;
}

/**
 * Acceso lazy al MicRecorder.
 * Evita cargar micrófono hasta que el usuario grabe.
 */
export class MicRecorderAccess {
  private _micRecorder: MicRecorder | null = null;
  private readonly _deps: MicRecorderAccessDeps;

  constructor(deps: MicRecorderAccessDeps) {
    this._deps = deps;
  }

  public async get(): Promise<MicRecorder> {
    if (this._deps.getState() !== 'ready') {
      throw new Error(
        '[AudioEngine] getMicRecorder() requiere estado ready. Llama a init() primero.'
      );
    }

    if (!this._micRecorder) {
      const micRecorder = new MicRecorder(
        'mic-recorder-main',
        this._deps.getContext(),
        { verbose: this._deps.verbose }
      );

      await micRecorder.init();
      micRecorder.monitorOutput.connect(this._deps.getMasterBus().input);
      this._micRecorder = micRecorder;
      this._deps.log('MicRecorder inicializado (lazy)');
    }

    return this._micRecorder;
  }

  public getSync(): MicRecorder | null {
    return this._micRecorder;
  }

  public dispose(): void {
    if (this._micRecorder) {
      this._micRecorder.dispose();
      this._micRecorder = null;
    }
  }
}