// src/audio/worklets/processors/EffectChain.ts
//
// Gestiona la cadena de inserts VST3 para una track.

import { vst3Bridge } from '@audio/plugins/vst3';
import { VST3_INSERT_PROCESSOR_NAME, VST3_MAX_BLOCK } from '../shared/WorkletConstants';

export interface EffectInsert {
  pluginKey: string;
  instanceId: string;
  bypass: boolean;
  workletNode: AudioWorkletNode | null;
}

export class EffectChain {
  private _ctx: AudioContext;
  private _trackId: string;
  private _inserts: EffectInsert[] = [];
  private _inputNode: GainNode;
  private _outputNode: GainNode;

  constructor(trackId: string, ctx: AudioContext) {
    this._trackId = trackId;
    this._ctx = ctx;
    this._inputNode = ctx.createGain();
    this._outputNode = ctx.createGain();
    this._inputNode.connect(this._outputNode);
  }

  /** Nodo donde se conecta la fuente (antes de FX) */
  get input(): GainNode {
    return this._inputNode;
  }

  /** Nodo donde se conecta el destino (después de FX) */
  get output(): GainNode {
    return this._outputNode;
  }

  get insertCount(): number {
    return this._inserts.length;
  }

  /**
   * Añade un insert VST3 al final de la cadena.
   * Debe llamarse DESPUÉS de activateProcessing en Rust.
   */
  async addInsert(
    pluginKey: string,
    instanceId: string,
    sampleRate: number,
    maxBlockSize: number = VST3_MAX_BLOCK
  ): Promise<boolean> {
    // 1) Activar processing en Rust
    const result = await vst3Bridge.activateProcessing(
      pluginKey,
      instanceId,
      sampleRate,
      maxBlockSize
    );

    if (!result.success) {
      console.error(
        `[EffectChain:${this._trackId}] activateProcessing falló:`,
        result.message
      );
      return false;
    }

    console.log(
      `[EffectChain:${this._trackId}] Processing activo — ` +
        `latency=${result.latency_samples} sr=${result.sample_rate}`
    );

    // 2) Crear AudioWorkletNode
    try {
      const node = new AudioWorkletNode(this._ctx, VST3_INSERT_PROCESSOR_NAME, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        processorOptions: {
          pluginKey,
          instanceId,
          bypass: false,
        },
      });

      // 3) Wire: escuchar peticiones del worklet y responder vía IPC
      node.port.onmessage = async (e: MessageEvent) => {
        if (e.data.type === 'needProcess') {
          try {
            const procResult = await vst3Bridge.processBlock(
              e.data.pluginKey,
              e.data.instanceId,
              e.data.inputL,
              e.data.inputR
            );

            if (procResult.success) {
              node.port.postMessage({
                type: 'processResult',
                outputL: procResult.output_l,
                outputR: procResult.output_r,
              });
            }
          } catch {
            // Silenciar errores de IPC para no flood la consola
          }
        }
      };

      // 4) Registrar nuevo insert y reconectar cadena
      this._inserts.push({
        pluginKey,
        instanceId,
        bypass: false,
        workletNode: node,
      });

      this._rebuildChain();

      return true;
    } catch (err) {
      console.error(
        `[EffectChain:${this._trackId}] Error creando worklet:`,
        err
      );
      return false;
    }
  }

  /** Reconstruye la cadena: input → insert1 → insert2 → ... → output */
  private _rebuildChain(): void {
    // Desconectar todo
    try { this._inputNode.disconnect(); } catch { /* */ }
    for (const ins of this._inserts) {
      try { ins.workletNode?.disconnect(); } catch { /* */ }
    }

    const activeInserts = this._inserts.filter(
      (i) => !i.bypass && i.workletNode
    );

    if (activeInserts.length === 0) {
      this._inputNode.connect(this._outputNode);
      return;
    }

    // input → first insert
    this._inputNode.connect(activeInserts[0].workletNode!);

    // insert → insert
    for (let i = 0; i < activeInserts.length - 1; i++) {
      activeInserts[i].workletNode!.connect(activeInserts[i + 1].workletNode!);
    }

    // last insert → output
    activeInserts[activeInserts.length - 1].workletNode!.connect(
      this._outputNode
    );
  }

  /** Toggle bypass de un insert por índice */
  setBypass(index: number, bypass: boolean): void {
    const ins = this._inserts[index];
    if (!ins) return;
    ins.bypass = bypass;
    ins.workletNode?.port.postMessage({ type: 'setBypass', bypass });
    this._rebuildChain();
  }

  /** Limpia todos los inserts y desconecta */
  dispose(): void {
    for (const ins of this._inserts) {
      try { ins.workletNode?.disconnect(); } catch { /* */ }
      ins.workletNode?.port.close();
    }
    this._inserts = [];
    try { this._inputNode.disconnect(); } catch { /* */ }
    try { this._outputNode.disconnect(); } catch { /* */ }
  }
}