import { memo, useCallback, useMemo } from 'react';
import { useMeter } from '@audio/hooks/useMeter';
import './VUMeter.css';

// ═══════════════════════════════════════════
// Constantes (escala profesional)
// ═══════════════════════════════════════════
const DB_MIN = -60;
const DB_MAX = 6;
const DB_RANGE = DB_MAX - DB_MIN; // 66 dB total

const DEFAULT_YELLOW_DB = -12;
const DEFAULT_RED_DB = -3;
const DEFAULT_HEIGHT = 180;
const DEFAULT_WIDTH = 12;
const DEFAULT_SEGMENTS = 24;
const STEREO_CHANNEL_WIDTH = 10;

// ═══════════════════════════════════════════
// Helpers puros
// ═══════════════════════════════════════════
const linearToDb = (v: number): number => {
  if (v <= 0) return DB_MIN;
  return 20 * Math.log10(v);
};

const dbToPct = (db: number): number => {
  const clamped = Math.max(DB_MIN, Math.min(DB_MAX, db));
  return ((clamped - DB_MIN) / DB_RANGE) * 100;
};

const linearToPct = (v: number): number => {
  if (v <= 0) return 0;
  return dbToPct(linearToDb(v));
};

const formatDb = (v: number): string => {
  if (v <= 0) return '-∞';
  const db = linearToDb(v);
  if (db <= DB_MIN) return '-∞';
  return `${db > 0 ? '+' : ''}${db.toFixed(1)}`;
};

// ═══════════════════════════════════════════
// Tipos internos
// ═══════════════════════════════════════════
interface SegmentEntry {
  index: number;
  /** Posición porcentual del centro del segmento (0-100) */
  segPct: number;
}

interface Thresholds {
  yellow: number;
  red: number;
}

// ═══════════════════════════════════════════
// Sub-componente: renderizado de segmentos
// (extraído para aislar re-renders del meter data)
// ═══════════════════════════════════════════
interface SegmentsProps {
  segmentEntries: SegmentEntry[];
  rmsPct: number;
  thresholds: Thresholds;
}

const MeterSegments = memo(function MeterSegments({
  segmentEntries,
  rmsPct,
  thresholds,
}: SegmentsProps) {
  return (
    <div className="vumeter-segments" aria-hidden="true">
      {segmentEntries.map(({ index, segPct }) => {
        const isActive = segPct <= rmsPct;
        const isRed = segPct > thresholds.red;
        const isYellow = segPct > thresholds.yellow && segPct <= thresholds.red;

        let colorClass = '';
        if (isActive) {
          colorClass = isRed ? 'active-red' : isYellow ? 'active-yellow' : 'active-green';
        }

        return (
          <div
            key={index}
            className={`vumeter-segment${colorClass ? ` ${colorClass}` : ''}`}
          />
        );
      })}
    </div>
  );
});

// ═══════════════════════════════════════════
// Props
// ═══════════════════════════════════════════
interface VUMeterProps {
  /** ID del meter ("master" o trackId) */
  id: string;
  /** Alto en px */
  height?: number;
  /** Ancho en px */
  width?: number;
  /** Número de LEDs/segmentos */
  segments?: number;
  /** Mostrar línea de peak hold */
  showPeakHold?: boolean;
  /** Mostrar indicador de clip superior */
  showClipIndicator?: boolean;
  /** Mostrar valor numérico en dB */
  showDbLabel?: boolean;
  /** Umbral amarillo en dB (default: -12) */
  yellowThresholdDb?: number;
  /** Umbral rojo en dB (default: -3) */
  redThresholdDb?: number;
  /** Callback al hacer click en el clip indicator (reset) */
  onClipReset?: () => void;
  /** Etiqueta ARIA */
  label?: string;
}

/**
 * VUMeter
 * -------
 * Medidor vertical de nivel profesional (estilo consola).
 *
 * Escala: -60 dB (abajo) hasta +6 dB (arriba).
 * Segmentado con colores: verde → amarillo → rojo.
 *
 * Se suscribe a MeterManager vía useMeter (60 FPS sin pasar por Redux).
 *
 * ✔ Memoizado
 * ✔ Segmentos en sub-componente aislado
 * ✔ Thresholds y estructura estática memoizados
 * ✔ Peak hold con guard (solo si > 0)
 * ✔ Clip indicator con teclado
 * ✔ ARIA correcto (role="meter")
 * ✔ id nullable/undefined manejado via useMeter
 */
function VUMeterBase({
  id,
  height = DEFAULT_HEIGHT,
  width = DEFAULT_WIDTH,
  segments = DEFAULT_SEGMENTS,
  showPeakHold = true,
  showClipIndicator = true,
  showDbLabel = false,
  yellowThresholdDb = DEFAULT_YELLOW_DB,
  redThresholdDb = DEFAULT_RED_DB,
  onClipReset,
  label,
}: VUMeterProps) {
  const meter = useMeter(id);

  // ── Umbrales: no cambian por frame, solo si cambian los props
  const thresholds = useMemo<Thresholds>(
    () => ({
      yellow: dbToPct(yellowThresholdDb),
      red: dbToPct(redThresholdDb),
    }),
    [yellowThresholdDb, redThresholdDb]
  );

  // ── Estructura de segmentos: solo cambia si cambia `segments`
  const segmentEntries = useMemo<SegmentEntry[]>(
    () =>
      Array.from({ length: segments }, (_, i) => ({
        index: i,
        segPct: ((i + 0.5) / segments) * 100,
      })),
    [segments]
  );

  // ── Estilo del contenedor: solo cambia si cambia height/width
  const containerStyle = useMemo(
    () => ({ height, width }),
    [height, width]
  );

  // ── Valores derivados por frame (no memoizados, son O(1))
  const rmsPct = linearToPct(meter.rms);
  const peakHoldPct = linearToPct(meter.peakHold);
  const rmsDb = formatDb(meter.rms);

  // ── Peak hold style memoizado: depende de peakHoldPct
  const peakHoldStyle = useMemo(
    () => ({ bottom: `${peakHoldPct}%` }),
    [peakHoldPct]
  );

  const isClipInteractive = Boolean(onClipReset);

  // ── Handlers del clip indicator
  const handleClipClick = useCallback(() => {
    onClipReset?.();
  }, [onClipReset]);

  const handleClipKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClipReset?.();
      }
    },
    [onClipReset]
  );

  // ── className del clip indicator memoizado
  const clipClassName = useMemo(() => {
    const parts = ['vumeter-clip'];
    if (meter.clipping) parts.push('is-clipping');
    if (isClipInteractive) parts.push('is-interactive');
    return parts.join(' ');
  }, [meter.clipping, isClipInteractive]);

  const clipTitle = meter.clipping
    ? isClipInteractive
      ? '¡Clipping! Click para resetear'
      : '¡Clipping!'
    : undefined;

  const clipAriaLabel = meter.clipping ? 'Clipping detectado' : 'Sin clipping';

  return (
    <div
      className="vumeter-container"
      style={containerStyle}
      role="meter"
      aria-label={label ?? `Nivel ${id}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(rmsPct)}
      aria-valuetext={`${rmsDb} dB`}
    >
      {/* ── Clip indicator ── */}
      {showClipIndicator && (
        <div
          className={clipClassName}
          onClick={isClipInteractive ? handleClipClick : undefined}
          onKeyDown={isClipInteractive ? handleClipKeyDown : undefined}
          role={isClipInteractive ? 'button' : undefined}
          tabIndex={isClipInteractive ? 0 : -1}
          title={clipTitle}
          aria-label={clipAriaLabel}
          aria-pressed={isClipInteractive ? meter.clipping : undefined}
        />
      )}

      {/* ── Track con segmentos ── */}
      <div className="vumeter-track">
        <MeterSegments
          segmentEntries={segmentEntries}
          rmsPct={rmsPct}
          thresholds={thresholds}
        />

        {/* Peak hold: solo si habilitado y hay valor real */}
        {showPeakHold && meter.peakHold > 0 && (
          <div
            className="vumeter-peakhold"
            style={peakHoldStyle}
            aria-hidden="true"
          />
        )}
      </div>

      {/* ── Label dB ── */}
      {showDbLabel && (
        <div className="vumeter-db-label mono" aria-hidden="true">
          {rmsDb}
        </div>
      )}
    </div>
  );
}

export const VUMeter = memo(VUMeterBase);

// ═══════════════════════════════════════════
// VUMeterStereo
// ═══════════════════════════════════════════

interface VUMeterStereoProps {
  /** ID base del meter */
  id: string;
  /** Alto en px */
  height?: number;
  /** Número de LEDs/segmentos */
  segments?: number;
  /** Mostrar peak hold */
  showPeakHold?: boolean;
  /** Mostrar clip indicator */
  showClipIndicator?: boolean;
  /** Mostrar label dB */
  showDbLabel?: boolean;
  /** Umbral amarillo en dB */
  yellowThresholdDb?: number;
  /** Umbral rojo en dB */
  redThresholdDb?: number;
  /** Callback reset clip (aplica a ambos canales) */
  onClipReset?: () => void;
  /** Etiqueta ARIA del grupo */
  label?: string;
}

/**
 * VUMeterStereo
 * -------------
 * Par de VUMeters (L/R) para un canal estéreo.
 *
 * Usa IDs `${id}:L` y `${id}:R` para que MeterManager
 * pueda publicar datos de cada canal independientemente.
 * Si el motor solo publica `id` (mono/sum), ambos canales
 * mostrarán el mismo nivel (useMeter retorna defaults para IDs sin datos).
 */
function VUMeterStereoBase({
  id,
  height = DEFAULT_HEIGHT,
  segments = DEFAULT_SEGMENTS,
  showPeakHold = true,
  showClipIndicator = true,
  showDbLabel = false,
  yellowThresholdDb = DEFAULT_YELLOW_DB,
  redThresholdDb = DEFAULT_RED_DB,
  onClipReset,
  label,
}: VUMeterStereoProps) {
  const baseLabel = label ?? id;

  const sharedMeterProps = {
    height,
    width: STEREO_CHANNEL_WIDTH,
    segments,
    showPeakHold,
    showClipIndicator,
    showDbLabel,
    yellowThresholdDb,
    redThresholdDb,
    onClipReset,
  } as const;

  return (
    <div
      className="vumeter-stereo"
      role="group"
      aria-label={`${baseLabel} estéreo`}
    >
      <VUMeter
        {...sharedMeterProps}
        id={`${id}:L`}
        label={`${baseLabel} izquierdo`}
      />
      <VUMeter
        {...sharedMeterProps}
        id={`${id}:R`}
        label={`${baseLabel} derecho`}
      />
    </div>
  );
}

export const VUMeterStereo = memo(VUMeterStereoBase);