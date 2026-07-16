// src/audio/recording/MicRecorder.ts

import type {
  IAudioRecorder,
  IRecordingResult,
  RecorderState,
} from '@domain/contracts/audio/IAudioRecorder';
import type {
  IParamDescriptor,
  IPluginPreset,
  AudioModuleListener,
  AudioModuleEvent,
} from '@domain/contracts/audio/audio.types';

import {
  DEFAULT_MIC_RECORDER_CONFIG,
  type MicRecorderConfig,
} from './recorder.types';
import type { RecorderWorkletMessage } from './recorder-messages';
import {
  loadRecorderWorklet,
  RECORDER_WORKLET_PROCESSOR_NAME,
} from './recorder-worklet-loader';
import {
  MIC_RECORDER_MANIFEST,
  MIC_RECORDER_PARAM_DESCRIPTORS,
  PARAM_INPUT_GAIN,
  PARAM_MONITORING,
  INPUT_GAIN_MIN,
  INPUT_GAIN_MAX,
} from './recorder-manifest';
import { RecorderBuffer } from './RecorderBuffer';

const FADE_TIME = 0.01;

interface PendingStop {
  resolve: (result: IRecordingResult) => void;
  reject: (err: Error) => void;
}

/**
 * MicRecorder
 * -----------
 * Grabador basado en AudioWorklet. Cumple IAudioRecorder.
 *
 * Signal path:
 *   sourceNode → inputGain → recorderWorklet → monitorGate → monitorOutput
 *                                    │
 *                                    └─► captura al RecorderBuffer
 */
export class MicRecorder implements IAudioRecorder {
  public readonly id: string;
  public readonly manifest = MIC_RECORDER_MANIFEST;

  private readonly _ctx: AudioContext;
  private readonly _config: Required<MicRecorderConfig>;

  private readonly _inputGain: GainNode;
  private readonly _monitorGate: GainNode;
  private readonly _monitorOutput: GainNode;
  private _worklet: AudioWorkletNode | null = null;

  private _state: RecorderState = 'idle';
  private _sourceNode: AudioNode | null = null;
  private _monitoring: boolean;
  private _inputGainValue: number;
  private _isDisposed = false;

  private readonly _buffer = new RecorderBuffer();
  private _recordingStartTime = 0;
  private _pendingStop: PendingStop | null = null;

  private readonly _listeners = new Set<AudioModuleListener>();

  constructor(
    id: string,
    ctx: AudioContext,
    config: MicRecorderConfig = {}
  ) {
    if (!id || typeof id !== 'string') {
      throw new Error('[MicRecorder] id inválido');
    }

    this.id = id;
    this._ctx = ctx;
    this._config = { ...DEFAULT_MIC_RECORDER_CONFIG, ...config };

    this._monitoring = this._config.monitoring;
    this._inputGainValue = clamp(
      this._config.inputGain,
      INPUT_GAIN_MIN,
      INPUT_GAIN_MAX
    );

    this._inputGain = ctx.createGain();
    this._inputGain.gain.value = this._inputGainValue;

    this._monitorGate = ctx.createGain();
    this._monitorGate.gain.value = this._monitoring ? 1 : 0;

    this._monitorOutput = ctx.createGain();
    this._monitorOutput.gain.value = 1;

    this._monitorGate.connect(this._monitorOutput);
    this._log(`Creado`);
  }

  // ═══════════════════════════════════════════
  // Init (carga worklet)
  // ═══════════════════════════════════════════

  public async init(): Promise<void> {
    this._assertNotDisposed();
    if (this._worklet) return;

    await loadRecorderWorklet(this._ctx);

    this._worklet = new AudioWorkletNode(
      this._ctx,
      RECORDER_WORKLET_PROCESSOR_NAME,
      {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [this._config.channelCount],
      }
    );

    this._worklet.port.onmessage = (
      event: MessageEvent<RecorderWorkletMessage>
    ) => this._handleWorkletMessage(event.data);

    this._worklet.onprocessorerror = (event: Event) => {
      this._log(`Error en worklet: ${event.type}`, 'error');
      this._emit({ type: 'error', error: new Error('RecorderProcessor error') });
    };

    this._inputGain.connect(this._worklet);
    this._worklet.connect(this._monitorGate);
    this._log('Worklet cargado');
  }

  // ═══════════════════════════════════════════
  // IAudioRecorder
  // ═══════════════════════════════════════════

  public get state(): RecorderState {
    return this._state;
  }

  public get monitorOutput(): AudioNode {
    return this._monitorOutput;
  }

  public arm(source: AudioNode): void {
    this._assertNotDisposed();
    if (!this._worklet) throw new Error('[MicRecorder] init() no llamado');
    if (this._state === 'recording') {
      throw new Error('[MicRecorder] No se puede rearmar durante grabación');
    }

    if (this._sourceNode) this._disconnectSource();

    source.connect(this._inputGain);
    this._sourceNode = source;
    this._state = 'armed';
    this._log('Armed');
  }

  public disarm(): void {
    if (this._isDisposed) return;

    if (this._state === 'recording') {
      try { this._worklet?.port.postMessage({ type: 'stop' }); } catch { /* ignore */ }
      this._buffer.reset();
      if (this._pendingStop) {
        this._pendingStop.reject(new Error('Recorder disarmed during recording'));
        this._pendingStop = null;
      }
    }

    this._disconnectSource();
    this._state = 'idle';
    this._log('Disarmed');
  }

  public isArmed(): boolean {
    return this._state === 'armed' || this._state === 'recording';
  }

  public setMonitoring(enabled: boolean): void {
    if (this._isDisposed) return;
    if (this._monitoring === enabled) return;

    this._monitoring = enabled;
    this._monitorGate.gain.setTargetAtTime(
      enabled ? 1 : 0,
      this._ctx.currentTime,
      FADE_TIME
    );
    this._emit({
      type: 'paramChanged',
      paramId: PARAM_MONITORING,
      value: enabled ? 1 : 0,
    });
  }

  public isMonitoring(): boolean {
    return this._monitoring;
  }

  public startRecording(_when?: number): void {
    this._assertNotDisposed();
    if (!this._worklet) throw new Error('[MicRecorder] Worklet no inicializado');
    if (this._state !== 'armed') {
      throw new Error(
        `[MicRecorder] startRecording requiere 'armed', actual: '${this._state}'`
      );
    }

    this._buffer.reset();
    this._recordingStartTime = this._ctx.currentTime;

    this._worklet.port.postMessage({ type: 'start' });
    this._state = 'recording';
    this._log('Recording started');
  }

  public stopRecording(): Promise<IRecordingResult> {
    if (this._state !== 'recording') {
      return Promise.reject(new Error(
        `[MicRecorder] stopRecording requiere 'recording', actual: '${this._state}'`
      ));
    }
    if (!this._worklet) {
      return Promise.reject(new Error('[MicRecorder] Worklet no inicializado'));
    }

    return new Promise<IRecordingResult>((resolve, reject) => {
      this._pendingStop = { resolve, reject };
      this._worklet?.port.postMessage({ type: 'stop' });
    });
  }

  public isRecording(): boolean {
    return this._state === 'recording';
  }

  public getCurrentDurationSec(): number {
    if (this._state !== 'recording') return 0;
    return this._buffer.totalSamples / this._ctx.sampleRate;
  }

  public getInputLevel(): number {
    return this._buffer.currentPeak;
  }

  // ═══════════════════════════════════════════
  // IAudioModule — params
  // ═══════════════════════════════════════════

  public getParamDescriptors(): readonly IParamDescriptor[] {
    return MIC_RECORDER_PARAM_DESCRIPTORS;
  }

  public getParam(paramId: string): number {
    switch (paramId) {
      case PARAM_INPUT_GAIN: return this._inputGainValue;
      case PARAM_MONITORING: return this._monitoring ? 1 : 0;
      default: return 0;
    }
  }

  public setParam(paramId: string, value: number): void {
    if (this._isDisposed) return;

    switch (paramId) {
      case PARAM_INPUT_GAIN: {
        const clamped = clamp(value, INPUT_GAIN_MIN, INPUT_GAIN_MAX);
        if (this._inputGainValue === clamped) return;
        this._inputGainValue = clamped;
        this._inputGain.gain.setTargetAtTime(
          clamped, this._ctx.currentTime, FADE_TIME
        );
        this._emit({ type: 'paramChanged', paramId, value: clamped });
        break;
      }
      case PARAM_MONITORING:
        this.setMonitoring(value >= 0.5);
        break;
    }
  }

  // ═══════════════════════════════════════════
  // Presets / bypass / eventos
  // ═══════════════════════════════════════════

  public savePreset(name: string): IPluginPreset {
    return {
      id: `${this.id}-preset-${Date.now()}`,
      name,
      pluginId: this.manifest.id,
      data: {
        inputGain: this._inputGainValue,
        monitoring: this._monitoring,
      },
    };
  }

  public loadPreset(preset: IPluginPreset): void {
    if (this._isDisposed) return;
    if (preset.pluginId !== this.manifest.id) {
      this._log(`Preset ignorado: pluginId no coincide`, 'warn');
      return;
    }
    const { inputGain, monitoring } = preset.data as {
      inputGain?: number;
      monitoring?: boolean;
    };
    if (typeof inputGain === 'number') this.setParam(PARAM_INPUT_GAIN, inputGain);
    if (typeof monitoring === 'boolean') this.setMonitoring(monitoring);
    this._emit({ type: 'presetLoaded', presetId: preset.id });
  }

  public isBypassed(): boolean { return false; }
  public setBypassed(_bypassed: boolean): void { /* N/A para recorder */ }

  public on(listener: AudioModuleListener): () => void {
    this._listeners.add(listener);
    return () => { this._listeners.delete(listener); };
  }

  private _emit(event: AudioModuleEvent): void {
    const snapshot = Array.from(this._listeners);
    for (const listener of snapshot) {
      try { listener(event); }
      catch (err) { console.error(`[MicRecorder:${this.id}] listener error:`, err); }
    }
  }

  // ═══════════════════════════════════════════
  // Dispose
  // ═══════════════════════════════════════════

  public get isDisposed(): boolean { return this._isDisposed; }

  public dispose(): void {
    if (this._isDisposed) return;

    try {
      if (this._state === 'recording') {
        try { this._worklet?.port.postMessage({ type: 'stop' }); } catch { /* ignore */ }
      }
      if (this._pendingStop) {
        this._pendingStop.reject(new Error('MicRecorder disposed'));
        this._pendingStop = null;
      }

      this._disconnectSource();

      if (this._worklet) {
        this._worklet.port.onmessage = null;
        this._worklet.onprocessorerror = null;
        try { this._worklet.disconnect(); } catch { /* ignore */ }
        this._worklet = null;
      }

      try { this._inputGain.disconnect(); } catch { /* ignore */ }
      try { this._monitorGate.disconnect(); } catch { /* ignore */ }
      try { this._monitorOutput.disconnect(); } catch { /* ignore */ }

      this._buffer.reset();
      this._isDisposed = true;
      this._state = 'idle';

      this._emit({ type: 'disposed' });
      this._listeners.clear();
      this._log('Disposed');
    } catch (err) {
      this._log(`Error en dispose: ${errMsg(err)}`, 'error');
    }
  }

  // ═══════════════════════════════════════════
  // Interno: worklet messages
  // ═══════════════════════════════════════════

  private _handleWorkletMessage(msg: RecorderWorkletMessage): void {
    if (!msg || typeof msg.type !== 'string') return;

    switch (msg.type) {
      case 'samples':
        if (this._state === 'recording') {
          this._buffer.appendChunk(msg.channels);
          this._maybeAutoStop();
        }
        break;

      case 'started':
        this._log(`Worklet started @ sr=${msg.sampleRate}`);
        break;

      case 'stopped':
        this._finalizeRecording();
        break;
    }
  }

  private _maybeAutoStop(): void {
    const durationSec = this._buffer.totalSamples / this._ctx.sampleRate;
    if (durationSec >= this._config.maxDurationSec) {
      this._log(
        `Max duration alcanzada (${this._config.maxDurationSec}s), auto-stop`,
        'warn'
      );
      this._worklet?.port.postMessage({ type: 'stop' });
    }
  }

  private _finalizeRecording(): void {
    if (!this._pendingStop) {
      this._log('Recibido stopped sin pendingStop, ignorado', 'warn');
      return;
    }

    const { resolve, reject } = this._pendingStop;
    this._pendingStop = null;

    try {
      const buffer = this._buffer.toAudioBuffer(this._ctx);
      const result: IRecordingResult = {
        id: `${this.id}-take-${Date.now()}`,
        buffer,
        startedAt: this._recordingStartTime,
        durationSec: buffer.duration,
        sampleRate: buffer.sampleRate,
        channelCount: buffer.numberOfChannels,
      };

      this._buffer.reset();
      this._state = this._sourceNode ? 'armed' : 'idle';

      resolve(result);
      this._log(`Recording finalizada: ${buffer.duration.toFixed(2)}s`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this._log(`Error al finalizar: ${error.message}`, 'error');
      reject(error);
    }
  }

  // ═══════════════════════════════════════════
  // Interno: helpers
  // ═══════════════════════════════════════════

  private _disconnectSource(): void {
    if (!this._sourceNode) return;
    try { this._sourceNode.disconnect(this._inputGain); } catch { /* ignore */ }
    this._sourceNode = null;
  }

  private _assertNotDisposed(): void {
    if (this._isDisposed) {
      throw new Error(`[MicRecorder:${this.id}] Ya fue disposed`);
    }
  }

  private _log(msg: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    if (!this._config.verbose && level === 'info') return;

    const prefix = `[MicRecorder:${this.id}]`;
    switch (level) {
      case 'error': console.error(prefix, msg); break;
      case 'warn':  console.warn(prefix, msg);  break;
      default:      console.info(prefix, msg);
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}