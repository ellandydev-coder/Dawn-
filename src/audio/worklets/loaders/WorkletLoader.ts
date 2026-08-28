// src/audio/worklets/loaders/WorkletLoader.ts
//
// Cargador y registrador centralizado de todos los AudioWorklets.
// Previene registros duplicados en el mismo AudioContext utilizando un WeakSet.
// Compatible con Vite 8 usando resolución estática de assets (new URL).

/** Mapa de estado para evitar registrar múltiples veces en un mismo contexto */
const loadedContexts = new WeakSet<AudioContext>();

/** Lista de worklets del Dawn Engine con sus rutas relativas */
const WORKLET_MODULES = [
  // Built-ins pre-existentes
  { name: 'meter-processor',       url: new URL('../processors/MeterProcessor.ts', import.meta.url).href },
  { name: 'eq-processor',          url: new URL('../processors/EqProcessor.ts', import.meta.url).href },
  { name: 'gain-processor',        url: new URL('../processors/GainProcessor.ts', import.meta.url).href },
  { name: 'limiter-processor',     url: new URL('../processors/LimiterProcessor.ts', import.meta.url).href },
  { name: 'compressor-processor',  url: new URL('../processors/CompressorProcessor.ts', import.meta.url).href },
  { name: 'recorder-processor',    url: new URL('../processors/RecorderProcessor.ts', import.meta.url).href },
  
  // VST3 Pipeline (Nuevo)
  { name: 'vst3-insert-processor', url: new URL('../processors/Vst3InsertProcessor.ts', import.meta.url).href },
] as const;

export class WorkletLoader {
  private static _loadingPromise: Promise<void> | null = null;

  /**
   * Carga de manera concurrente todos los módulos AudioWorklet requeridos.
   * Se asegura de que se registren exactamente una vez por AudioContext.
   * 
   * @param ctx AudioContext donde registrar los procesadores.
   */
  static async loadAll(ctx: AudioContext): Promise<void> {
    if (loadedContexts.has(ctx)) {
      return;
    }

    // Si ya hay una carga en curso en este mismo hilo, esperamos a que termine
    if (this._loadingPromise) {
      return this._loadingPromise;
    }

    this._loadingPromise = (async () => {
      console.log('[WorkletLoader] Iniciando registro de módulos...');

      const results = await Promise.allSettled(
        WORKLET_MODULES.map(async (m) => {
          try {
            await ctx.audioWorklet.addModule(m.url);
            return { name: m.name, success: true };
          } catch (err) {
            console.error(`[WorkletLoader] Error cargando ${m.name}:`, err);
            return { name: m.name, success: false, error: err };
          }
        })
      );

      const failed = results.filter(
        (r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
      );

      if (failed.length > 0) {
        console.warn(
          `[WorkletLoader] Registro completado con errores. ${failed.length} fallidos.`,
          failed
        );
      } else {
        console.log('[WorkletLoader] Todos los AudioWorklets cargados con éxito.');
        loadedContexts.add(ctx);
      }
    })();

    try {
      await this._loadingPromise;
    } finally {
      this._loadingPromise = null;
    }
  }

  /** Devuelve si el contexto especificado ya tiene los worklets cargados */
  static isLoaded(ctx: AudioContext): boolean {
    return loadedContexts.has(ctx);
  }
}