// src/features/clip-properties/components/ClipPropertiesModal.tsx
// ═══════════════════════════════════════════════════════════════
// 🏗️ ClipPropertiesModal — Componente principal
// ═══════════════════════════════════════════════════════════════

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';

import { useAppDispatch, useAppSelector } from '@state/store';
import { selectClipById } from '@state/selectors/clipSelectors';
import {
  moveClip,
  resizeClip,
  renameClip,
  setClipGain,
  setClipFadeIn,
  setClipFadeOut,
  setClipOffset,
} from '@state/slices/clips/clipsSlice';
import { Modal } from '@shared/components/Modal';
import {
  linearToDb,
  dbToLinear,
  DB_MIN,
  DB_MAX,
  SILENCE_SYMBOL,
} from '@shared/utils/dBConversion';
import type { Asset } from '@domain/models/Asset';

import type { ClipPropertiesModalProps, EditableState } from '../types';
import { FADE_CURVE_LINEAR } from '../types';
import { clipToEditableState, statesEqual, validateDraft } from '../utils/validation';
import { formatTime, formatSampleRate, formatChannels, formatFileSize } from '../utils/formatters';
import { TimeInput } from './TimeInput';
import { EmptyState } from './EmptyState';

import './ClipPropertiesModal.css';

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════

function ClipPropertiesModalBase({
  clipId,
  onClose,
}: ClipPropertiesModalProps) {
  const dispatch = useAppDispatch();

  // ─── Datos del store ────────────────────────────────────────

  const clip = useAppSelector((s) =>
    clipId ? selectClipById(s, clipId) : null
  );

  const asset = useAppSelector<Asset | null>((s) => {
    const assetId = clip?.assetId;
    if (!assetId) return null;
    return s.assets.byId[assetId] ?? null;
  });

  // ─── Estado local editable ──────────────────────────────────

  const [draft, setDraft] = useState<EditableState | null>(
    clip ? clipToEditableState(clip) : null
  );

  const lastClipIdRef = useRef<string | null>(clipId);
  useEffect(() => {
    const nextId = clip?.id ?? null;
    if (nextId === lastClipIdRef.current) return;
    lastClipIdRef.current = nextId;
    setDraft(clip ? clipToEditableState(clip) : null);
  }, [clip]);

  // ─── Estados derivados ──────────────────────────────────────

  const hasClip = clip !== null && draft !== null;

  const isDirty = useMemo(() => {
    if (!clip || !draft) return false;
    return !statesEqual(draft, clipToEditableState(clip));
  }, [clip, draft]);

  const validationError = useMemo<string | null>(() => {
    if (!draft) return null;
    return validateDraft(draft);
  }, [draft]);

  const canApply = hasClip && isDirty && validationError === null;
  const canOk = hasClip && validationError === null;

  // ═══════════════════════════════════════════════════════════
  // HANDLERS — Field updates
  // ═══════════════════════════════════════════════════════════

  const updateField = useCallback(
    <K extends keyof EditableState>(key: K, value: EditableState[K]) => {
      setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
    },
    []
  );

  const handleNameChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      updateField('name', e.target.value);
    },
    [updateField]
  );

  const handleStartTimeCommit = useCallback(
    (v: number) => updateField('startTime', v),
    [updateField]
  );
  const handleDurationCommit = useCallback(
    (v: number) => updateField('duration', v),
    [updateField]
  );
  const handleOffsetCommit = useCallback(
    (v: number) => updateField('offset', v),
    [updateField]
  );
  const handleFadeInCommit = useCallback(
    (v: number) => updateField('fadeIn', v),
    [updateField]
  );
  const handleFadeOutCommit = useCallback(
    (v: number) => updateField('fadeOut', v),
    [updateField]
  );

  const handleGainDbChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const db = Number(e.target.value);
      if (!Number.isFinite(db)) return;
      const clampedDb = Math.max(DB_MIN, Math.min(DB_MAX, db));
      updateField('gain', dbToLinear(clampedDb));
    },
    [updateField]
  );

  // ═══════════════════════════════════════════════════════════
  // HANDLERS — Apply / Cancel / OK
  // ═══════════════════════════════════════════════════════════

  const applyChanges = useCallback((): boolean => {
    if (!clip || !draft || validationError !== null) return false;
    if (!isDirty) return true;

    if (draft.name !== clip.name) {
      dispatch(renameClip({ id: clip.id, name: draft.name }));
    }
    if (draft.startTime !== clip.startTime) {
      dispatch(moveClip({ id: clip.id, startTime: draft.startTime }));
    }
    if (draft.duration !== clip.duration) {
      dispatch(resizeClip({ id: clip.id, duration: draft.duration }));
    }
    if (draft.offset !== clip.offset) {
      dispatch(setClipOffset({ id: clip.id, offset: draft.offset }));
    }
    if (draft.gain !== clip.gain) {
      dispatch(setClipGain({ id: clip.id, gain: draft.gain }));
    }
    if (draft.fadeIn !== clip.fadeIn) {
      dispatch(setClipFadeIn({ id: clip.id, fadeIn: draft.fadeIn }));
    }
    if (draft.fadeOut !== clip.fadeOut) {
      dispatch(setClipFadeOut({ id: clip.id, fadeOut: draft.fadeOut }));
    }
    return true;
  }, [clip, draft, isDirty, validationError, dispatch]);

  const handleApply = useCallback(() => {
    applyChanges();
  }, [applyChanges]);

  const handleOk = useCallback(() => {
    if (hasClip) applyChanges();
    onClose();
  }, [hasClip, applyChanges, onClose]);

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  // ═══════════════════════════════════════════════════════════
  // KEYBOARD: Enter → OK
  // ═══════════════════════════════════════════════════════════

  useEffect(() => {
    if (!hasClip) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;

      const target = e.target as HTMLElement | null;
      if (!target || target.tagName !== 'INPUT') return;
      if (!target.closest('.modal-container')) return;

      const type = target.getAttribute('type');
      if (type === 'range' || type === 'checkbox' || type === 'radio') return;

      e.preventDefault();
      target.blur();
      handleOk();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hasClip, handleOk]);

  // ═══════════════════════════════════════════════════════════
  // Derivados de UI
  // ═══════════════════════════════════════════════════════════

  const gainDbDisplay = useMemo(() => {
    if (!draft) return '0.0';
    const db = linearToDb(draft.gain);
    if (!Number.isFinite(db)) return SILENCE_SYMBOL;
    return db.toFixed(1);
  }, [draft]);

  const gainDbNumeric = useMemo(() => {
    if (!draft) return DB_MIN;
    const db = linearToDb(draft.gain);
    return Number.isFinite(db) ? db : DB_MIN;
  }, [draft]);

  const modalTitle = useMemo(() => {
    if (!clip) return 'Media Item Properties';
    return `Media Item Properties: ${clip.name}`;
  }, [clip]);

  const isOpen = clipId !== null;

  const applyTitle = !hasClip
    ? 'Selecciona un clip para editar'
    : !isDirty
      ? 'Sin cambios por aplicar'
      : (validationError ?? 'Aplicar cambios sin cerrar');

  const okTitle = !hasClip
    ? 'Selecciona un clip para editar'
    : (validationError ?? 'Aplicar y cerrar');

  // ═══════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title={modalTitle}
      size="lg"
      footer={
        <>
          {hasClip && validationError && (
            <span className="clip-props-error" role="alert">
              {validationError}
            </span>
          )}
          <button type="button" className="modal-btn" onClick={handleCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="modal-btn"
            onClick={handleApply}
            disabled={!canApply}
            title={applyTitle}
          >
            Apply
          </button>
          <button
            type="button"
            className="modal-btn is-primary"
            onClick={handleOk}
            disabled={!canOk}
            title={okTitle}
          >
            OK
          </button>
        </>
      }
    >
      {!hasClip ? (
        <EmptyState />
      ) : (
        <div className="clip-props" key={clip.id}>
          {/* SECCIÓN 1: Position / Length / Fades */}
          <section className="clip-props-section">
            <div className="clip-props-grid clip-props-grid-2col">
              <div className="clip-props-field">
                <label htmlFor="clip-position">Position:</label>
                <TimeInput id="clip-position" className="clip-props-input mono" value={draft.startTime} onCommit={handleStartTimeCommit} />
              </div>
              <div className="clip-props-field">
                <label htmlFor="clip-fade-in">Fade in:</label>
                <TimeInput id="clip-fade-in" className="clip-props-input mono" value={draft.fadeIn} onCommit={handleFadeInCommit} />
              </div>
              <div className="clip-props-field">
                <label htmlFor="clip-length">Length:</label>
                <TimeInput id="clip-length" className="clip-props-input mono" value={draft.duration} onCommit={handleDurationCommit} />
              </div>
              <div className="clip-props-field">
                <label htmlFor="clip-fade-out">Fade out:</label>
                <TimeInput id="clip-fade-out" className="clip-props-input mono" value={draft.fadeOut} onCommit={handleFadeOutCommit} />
              </div>
              <div className="clip-props-field">
                <label htmlFor="clip-offset">Start in source:</label>
                <TimeInput id="clip-offset" className="clip-props-input mono" value={draft.offset} onCommit={handleOffsetCommit} />
              </div>
              <div className="clip-props-field">
                <label htmlFor="clip-curve">Curve:</label>
                <input id="clip-curve" type="text" className="clip-props-input mono" value={FADE_CURVE_LINEAR.toFixed(2)} readOnly disabled title="Curvas de fade personalizadas: próximamente" />
              </div>
            </div>
          </section>

          {/* SECCIÓN 2: Take properties */}
          <section className="clip-props-section">
            <div className="clip-props-section-title">Take properties</div>
            <div className="clip-props-field clip-props-field-full">
              <label htmlFor="clip-name">Take name:</label>
              <input id="clip-name" type="text" className="clip-props-input" value={draft.name} onChange={handleNameChange} spellCheck={false} autoComplete="off" maxLength={256} />
            </div>
            <div className="clip-props-grid clip-props-grid-2col">
              <div className="clip-props-field">
                <label htmlFor="clip-gain">Volume:</label>
                <div className="clip-props-inline">
                  <input id="clip-gain" type="range" className="clip-props-slider" min={DB_MIN} max={DB_MAX} step={0.1} value={gainDbNumeric} onChange={handleGainDbChange} aria-valuetext={`${gainDbDisplay} dB`} />
                  <span className="clip-props-value mono">{gainDbDisplay} dB</span>
                </div>
              </div>
              <div className="clip-props-field">
                <label htmlFor="clip-pitch">Pitch:</label>
                <input id="clip-pitch" type="text" className="clip-props-input mono" value="0.000000" readOnly disabled title="Pitch shift (semitonos): próximamente" />
              </div>
            </div>
          </section>

          {/* SECCIÓN 3: Media source (read-only) */}
          <section className="clip-props-section">
            <div className="clip-props-section-title">
              Take media source
              {asset && <span className="clip-props-badge">{formatChannels(asset.numberOfChannels)}</span>}
            </div>
            {asset ? (
              <>
                <div className="clip-props-field clip-props-field-full">
                  <label htmlFor="asset-file">File:</label>
                  <input id="asset-file" type="text" className="clip-props-input" value={asset.name} readOnly title={asset.name} />
                </div>
                <div className="clip-props-grid clip-props-grid-3col">
                  <div className="clip-props-field">
                    <label htmlFor="asset-duration">Duration:</label>
                    <input id="asset-duration" type="text" className="clip-props-input mono" value={formatTime(asset.duration)} readOnly />
                  </div>
                  <div className="clip-props-field">
                    <label htmlFor="asset-sr">Sample rate:</label>
                    <input id="asset-sr" type="text" className="clip-props-input mono" value={formatSampleRate(asset.sampleRate)} readOnly />
                  </div>
                  <div className="clip-props-field">
                    <label htmlFor="asset-size">Size:</label>
                    <input id="asset-size" type="text" className="clip-props-input mono" value={formatFileSize(asset.sizeBytes)} readOnly />
                  </div>
                </div>
              </>
            ) : (
              <div className="clip-props-empty">
                Este clip no tiene un asset de audio asociado.
              </div>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}

export const ClipPropertiesModal = memo(ClipPropertiesModalBase);