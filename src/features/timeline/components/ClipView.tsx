// src/features/timeline/components/ClipView.tsx

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  useState,
  type CSSProperties,
} from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useAppDispatch } from '@state/store';
import { selectClips, toggleClipSelection } from '@state/slices/clips/clipsSlice';
import { AssetRegistry } from '@services/assets/AssetRegistry';
import { WaveformGenerator } from '@audio/analysis/WaveformGenerator';

// ═══════════════════════════════════════════
// Constantes
// ═══════════════════════════════════════════

const MIN_CLIP_WIDTH = 20;
const WAVEFORM_REDRAW_THRESHOLD = 4;
const MIN_HEADER_HEIGHT = 12;
const MAX_DISPLAY_NAME_LENGTH = 40;

const CLICK_MOVEMENT_THRESHOLD = 3;

// ═══════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(2)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1).padStart(4, '0');
  return `${mins}:${secs}`;
}

function truncateName(name: string, max = MAX_DISPLAY_NAME_LENGTH): string {
  return name.length > max ? `${name.slice(0, max)}…` : name;
}

function buildAriaLabel(
  name: string,
  durationText: string,
  isMuted: boolean,
  isSelected: boolean
): string {
  const parts = [`Clip: ${name}`, `duración ${durationText}`];
  if (isMuted) parts.push('silenciado');
  if (isSelected) parts.push('seleccionado');
  return parts.join(', ');
}

/**
 * Convierte un color CSS ('#7a8cff' o 'var(--track-1)') a un RGB usable en canvas.
 * Si es una var CSS, la resuelve leyendo el computed style del body.
 */
function resolveColor(cssColor: string): string {
  if (cssColor.startsWith('var(')) {
    const varName = cssColor.slice(4, -1).trim();
    const resolved = getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim();
    return resolved || '#7a8cff';
  }
  return cssColor;
}

// ═══════════════════════════════════════════
// Tipos
// ═══════════════════════════════════════════

export interface ClipViewProps {
  clipId: string;
  name: string;
  color: string;
  left: number;
  width: number;
  duration: number;
  assetId: string | null;
  isDragging?: boolean;
  isSelected?: boolean;
  isMuted?: boolean;
  showWaveform?: boolean;
  showRms?: boolean;
  onMouseDown: (e: ReactMouseEvent<HTMLDivElement>) => void;
  onDoubleClick: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onContextMenu?: (e: ReactMouseEvent<HTMLDivElement>) => void;
}

function ClipViewBase({
  clipId,
  name,
  color,
  left,
  width,
  duration,
  assetId,
  isDragging = false,
  isSelected = false,
  isMuted = false,
  showWaveform = true,
  showRms = true,
  onMouseDown,
  onDoubleClick,
  onKeyDown,
  onContextMenu,
}: ClipViewProps) {
  const dispatch = useAppDispatch();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const lastRenderedWidthRef = useRef<number>(0);
  const lastRenderedHeightRef = useRef<number>(0);
  const lastRenderedAssetIdRef = useRef<string | null>(null);
  const rafIdRef = useRef<number | null>(null);

  /** Altura real del body del clip (medida por ResizeObserver + DOM). */
  const [bodyHeight, setBodyHeight] = useState<number>(0);

  const mouseDownInfoRef = useRef<{
    x: number;
    y: number;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    button: number;
  } | null>(null);

  const clampedWidth = Math.max(MIN_CLIP_WIDTH, Math.floor(width));

  // ═══════════════════════════════════
  // Derivados memoizados
  // ═══════════════════════════════════

  const displayName = useMemo(() => truncateName(name), [name]);
  const durationText = useMemo(() => formatDuration(duration), [duration]);

  const ariaLabel = useMemo(
    () => buildAriaLabel(name, durationText, isMuted, isSelected),
    [name, durationText, isMuted, isSelected]
  );

  const clipClassName = useMemo(
    () =>
      [
        'clip-v2',
        isDragging && 'is-dragging-live',
        isSelected && 'is-selected',
        isMuted && 'is-muted',
      ]
        .filter(Boolean)
        .join(' '),
    [isDragging, isSelected, isMuted]
  );

  const rootStyle = useMemo<CSSProperties>(
    () => ({
      left,
      width: clampedWidth,
      borderColor: color,
    }),
    [left, clampedWidth, color]
  );

  const headerStyle = useMemo<CSSProperties>(
    () => ({
      background: color,
      minHeight: MIN_HEADER_HEIGHT,
    }),
    [color]
  );

  const tooltipText = useMemo(
    () =>
      `${name}\n${durationText}\n\nClic para seleccionar · F2 para propiedades · Arrastra para mover · Doble-clic para eliminar · Del para borrar`,
    [name, durationText]
  );

  // ═══════════════════════════════════
  // ResizeObserver + medición inicial DOM
  // ═══════════════════════════════════

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;

    const initial = el.getBoundingClientRect().height;
    if (initial > 0) {
      setBodyHeight(Math.round(initial));
    }

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = Math.round(entry.contentRect.height);
        if (h > 0) {
          setBodyHeight((prev) => (prev !== h ? h : prev));
        }
      }
    });

    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, []);

  // ═══════════════════════════════════
  // Waveform render — REAL, estilo FL Studio / Audacity
  // ═══════════════════════════════════

  const renderWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const bodyEl = bodyRef.current;
    if (!canvas || !bodyEl || !assetId || !showWaveform) return;

    const buffer = AssetRegistry.get(assetId);
    if (!buffer) return;

    const domHeight = Math.round(bodyEl.getBoundingClientRect().height);
    const cssHeight = Math.max(1, domHeight || bodyHeight);

    if (cssHeight === 0 || clampedWidth === 0) return;

    const dpr = window.devicePixelRatio || 1;

    canvas.width = clampedWidth * dpr;
    canvas.height = cssHeight * dpr;
    canvas.style.width = `${clampedWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, clampedWidth, cssHeight);

    // Color resuelto de la track (para pintar la waveform en color vivo)
    const trackColor = resolveColor(color);

    const peaks = WaveformGenerator.getOrCreate(
      assetId,
      buffer,
      clampedWidth,
      { normalize: true }
    );

    // Combinar canales
    const combinedMin = new Float32Array(clampedWidth);
    const combinedMax = new Float32Array(clampedWidth);
    const combinedRms = new Float32Array(clampedWidth);

    for (let x = 0; x < clampedWidth; x++) {
      let mn = 0;
      let mx = 0;
      let rms = 0;

      for (let ch = 0; ch < peaks.channels; ch++) {
        if (peaks.min[ch][x] < mn) mn = peaks.min[ch][x];
        if (peaks.max[ch][x] > mx) mx = peaks.max[ch][x];
        if (peaks.rms[ch][x] > rms) rms = peaks.rms[ch][x];
      }

      combinedMin[x] = mn;
      combinedMax[x] = mx;
      combinedRms[x] = rms;
    }

    const centerY = cssHeight / 2;
    const amp = cssHeight / 2 - 1;

    // ─── 1. Línea central SIEMPRE VISIBLE (fondo) ───
    // Se pinta primero, así queda "debajo" de la waveform.
    // Estilo FL/Audacity: línea continua horizontal que marca el 0.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.20)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY + 0.5);
    ctx.lineTo(clampedWidth, centerY + 0.5);
    ctx.stroke();

    // ─── 2. Peaks (silueta) ───
    // Color de la track con transparencia media.
    ctx.fillStyle = hexToRgba(trackColor, 0.65);
    ctx.beginPath();
    ctx.moveTo(0, centerY - combinedMax[0] * amp);
    for (let x = 1; x < clampedWidth; x++) {
      ctx.lineTo(x, centerY - combinedMax[x] * amp);
    }
    for (let x = clampedWidth - 1; x >= 0; x--) {
      ctx.lineTo(x, centerY - combinedMin[x] * amp);
    }
    ctx.closePath();
    ctx.fill();

    // ─── 3. RMS (cuerpo sólido, más claro) ───
    if (showRms) {
      ctx.fillStyle = hexToRgba(trackColor, 1);
      ctx.beginPath();
      ctx.moveTo(0, centerY - combinedRms[0] * amp);
      for (let x = 1; x < clampedWidth; x++) {
        ctx.lineTo(x, centerY - combinedRms[x] * amp);
      }
      for (let x = clampedWidth - 1; x >= 0; x--) {
        ctx.lineTo(x, centerY + combinedRms[x] * amp);
      }
      ctx.closePath();
      ctx.fill();
    }

    // ─── 4. Outline superior nítido (define la silueta) ───
    // Le da el look "cortado" clásico de Audacity.
    ctx.strokeStyle = hexToRgba(trackColor, 1);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < clampedWidth; x++) {
      const y = centerY - combinedMax[x] * amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.beginPath();
    for (let x = 0; x < clampedWidth; x++) {
      const y = centerY - combinedMin[x] * amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    lastRenderedWidthRef.current = clampedWidth;
    lastRenderedHeightRef.current = cssHeight;
    lastRenderedAssetIdRef.current = assetId;
  }, [assetId, clampedWidth, bodyHeight, showWaveform, showRms, color]);

  // Trigger rAF cuando cambia el ancho, la altura, o el assetId
  useEffect(() => {
    if (bodyHeight === 0) return;

    const widthDiff = Math.abs(clampedWidth - lastRenderedWidthRef.current);
    const heightDiff = Math.abs(bodyHeight - lastRenderedHeightRef.current);
    const assetChanged = assetId !== lastRenderedAssetIdRef.current;

    const widthNeedsRedraw =
      widthDiff >= WAVEFORM_REDRAW_THRESHOLD ||
      lastRenderedWidthRef.current === 0;
    const heightNeedsRedraw =
      heightDiff >= 1 || lastRenderedHeightRef.current === 0;

    if (!widthNeedsRedraw && !heightNeedsRedraw && !assetChanged) return;

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = requestAnimationFrame(() => {
      renderWaveform();
      rafIdRef.current = null;
    });

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [clampedWidth, bodyHeight, assetId, renderWaveform]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  // ═══════════════════════════════════
  // 🖱️ MOUSE HANDLERS — Click vs Drag
  // ═══════════════════════════════════

  const handleMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (e.button === 0 && e.detail !== 2) {
        mouseDownInfoRef.current = {
          x: e.clientX,
          y: e.clientY,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          shiftKey: e.shiftKey,
          button: e.button,
        };
      }

      onMouseDown(e);
    },
    [onMouseDown]
  );

  useEffect(() => {
    const handleWindowMouseUp = (e: MouseEvent) => {
      const info = mouseDownInfoRef.current;
      if (!info) return;

      mouseDownInfoRef.current = null;

      if (e.button !== info.button) return;

      const dx = Math.abs(e.clientX - info.x);
      const dy = Math.abs(e.clientY - info.y);
      const moved = Math.max(dx, dy) > CLICK_MOVEMENT_THRESHOLD;

      if (moved) return;

      if (info.ctrlKey || info.metaKey) {
        dispatch(toggleClipSelection(clipId));
      } else {
        dispatch(selectClips([clipId]));
      }
    };

    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [clipId, dispatch]);

  // ═══════════════════════════════════
  // ⌨️ KEYBOARD
  // ═══════════════════════════════════

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onDoubleClick();
        return;
      }
      onKeyDown?.(e);
    },
    [onDoubleClick, onKeyDown]
  );

  // ═══════════════════════════════════
  // Render
  // ═══════════════════════════════════

  return (
    <div
      className={clipClassName}
      style={rootStyle}
      title={tooltipText}
      onMouseDown={handleMouseDown}
      onDoubleClick={onDoubleClick}
      onKeyDown={handleKeyDown}
      onContextMenu={onContextMenu}
      tabIndex={0}
      role="button"
      aria-label={ariaLabel}
      aria-selected={isSelected}
      aria-disabled={isMuted}
      data-clip-id={clipId}
    >
      <div className="clip-header" style={headerStyle}>
        <span className="clip-header-name" title={name}>
          {displayName}
        </span>
      </div>

      <div ref={bodyRef} className="clip-body">
        {showWaveform && (
          <canvas
            ref={canvasRef}
            className="clip-waveform"
            aria-hidden="true"
          />
        )}
        <span className="clip-body-duration mono" aria-hidden="true">
          {durationText}
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Helper: hex → rgba
// ═══════════════════════════════════════════

function hexToRgba(hex: string, alpha: number): string {
  // Si ya es rgba/rgb, devolver como está (para gradients futuros)
  if (hex.startsWith('rgb')) return hex;

  const clean = hex.replace('#', '');
  const bigint = parseInt(clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const areEqual = (prev: ClipViewProps, next: ClipViewProps): boolean =>
  prev.clipId === next.clipId &&
  prev.name === next.name &&
  prev.color === next.color &&
  prev.left === next.left &&
  prev.width === next.width &&
  prev.duration === next.duration &&
  prev.assetId === next.assetId &&
  prev.isDragging === next.isDragging &&
  prev.isSelected === next.isSelected &&
  prev.isMuted === next.isMuted &&
  prev.showWaveform === next.showWaveform &&
  prev.showRms === next.showRms;

export const ClipView = memo(ClipViewBase, areEqual);