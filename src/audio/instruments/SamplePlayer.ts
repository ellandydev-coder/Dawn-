import { audioEngine } from '@audio/engine/AudioEngine';

/**
 * SamplePlayer
 * ------------
 * Reproductor simple de AudioBuffer.
 * Cada llamada a play() crea un nuevo AudioBufferSourceNode
 * (así lo exige la Web Audio API: los sources son de un solo uso).
 */
export class SamplePlayer {
  /**
   * Reproduce un buffer en la pista indicada.
   * @param buffer El AudioBuffer a reproducir
   * @param trackId ID de la pista destino (para enrutar por su cadena de audio)
   * @param when Cuándo reproducir (en tiempo del AudioContext). Default: ya.
   */
  public static play(
    buffer: AudioBuffer,
    trackId: string,
    when: number = 0
  ): AudioBufferSourceNode | null {
    const trackNode = audioEngine.routingGraph.getTrack(trackId);
    if (!trackNode) {
      console.warn(`[SamplePlayer] Track no encontrada: ${trackId}`);
      return null;
    }

    // Cada reproducción crea un source nuevo (regla de Web Audio)
    const source = audioEngine.context.createBufferSource();
    source.buffer = buffer;

    // Conectamos: source → entrada de la pista → panner → gain → master
    source.connect(trackNode.input);

    // Programamos la reproducción
    const startTime = when > 0 ? when : audioEngine.currentTime;
    source.start(startTime);

    return source;
  }
}