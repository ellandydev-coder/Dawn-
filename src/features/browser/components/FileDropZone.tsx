// src/features/browser/components/FileDropZone.tsx

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type DragEvent,
  type ChangeEvent,
} from 'react';
import { Icon } from '@shared/components/Icon';

// ═══════════════════════════════════════════
// Constantes
// ═══════════════════════════════════════════

export const DEFAULT_AUDIO_EXTENSIONS = [
  'wav',
  'mp3',
  'ogg',
  'flac',
  'aac',
  'm4a',
  'webm',
] as const;

const REJECT_DISPLAY_MS = 4000;

// ═══════════════════════════════════════════
// Tipos
// ═══════════════════════════════════════════

export interface RejectedFile {
  name: string;
  reason: 'extension' | 'size' | 'limit';
}

export interface FileDropZoneProps {
  onFilesDropped: (files: FileList) => void;
  onRejected?: (rejected: RejectedFile[]) => void;
  allowedExtensions?: readonly string[];
  maxFiles?: number;
  maxSizeMB?: number;
  disabled?: boolean;
  label?: string;
  hint?: string;
}

// ═══════════════════════════════════════════
// Helpers puros
// ═══════════════════════════════════════════

function getExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

function validateFiles(
  files: FileList,
  allowedExtensions: readonly string[],
  maxFiles: number,
  maxSizeMB: number
): { valid: File[]; rejected: RejectedFile[] } {
  const valid: File[] = [];
  const rejected: RejectedFile[] = [];
  const maxBytes = maxSizeMB > 0 ? maxSizeMB * 1024 * 1024 : Infinity;

  for (const file of Array.from(files)) {
    const ext = getExtension(file.name);

    if (!allowedExtensions.includes(ext)) {
      rejected.push({ name: file.name, reason: 'extension' });
      continue;
    }

    if (file.size > maxBytes) {
      rejected.push({ name: file.name, reason: 'size' });
      continue;
    }

    if (maxFiles > 0 && valid.length >= maxFiles) {
      rejected.push({ name: file.name, reason: 'limit' });
      continue;
    }

    valid.push(file);
  }

  return { valid, rejected };
}

function formatRejectReason(r: RejectedFile): string {
  switch (r.reason) {
    case 'extension':
      return `${r.name} (formato no permitido)`;
    case 'size':
      return `${r.name} (demasiado grande)`;
    case 'limit':
      return `${r.name} (límite alcanzado)`;
  }
}

function filesToFileList(files: File[]): FileList {
  const dt = new DataTransfer();
  for (const f of files) dt.items.add(f);
  return dt.files;
}

// ═══════════════════════════════════════════
// Componente
// ═══════════════════════════════════════════

export function FileDropZone({
  onFilesDropped,
  onRejected,
  allowedExtensions = DEFAULT_AUDIO_EXTENSIONS,
  maxFiles = 0,
  maxSizeMB = 0,
  disabled = false,
  label,
  hint,
}: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [rejectedFiles, setRejectedFiles] = useState<RejectedFile[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const rejectTimeoutRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  // ── Refs estables para callbacks opcionales (actualizadas en useEffect)
  const onFilesDroppedRef = useRef(onFilesDropped);
  const onRejectedRef = useRef(onRejected);

  useEffect(() => { onFilesDroppedRef.current = onFilesDropped; }, [onFilesDropped]);
  useEffect(() => { onRejectedRef.current = onRejected; }, [onRejected]);

  // ═══════════════════════════════════
  // Cleanup
  // ═══════════════════════════════════

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (rejectTimeoutRef.current !== null) {
        window.clearTimeout(rejectTimeoutRef.current);
      }
    };
  }, []);

  // ═══════════════════════════════════
  // Derivados memoizados
  // ═══════════════════════════════════

  const acceptString = useMemo(
    () => allowedExtensions.map((ext) => `.${ext}`).join(','),
    [allowedExtensions]
  );

  const displayLabel = useMemo(() => {
    if (label) return label;
    return isDragging && !disabled ? 'Suelta aquí' : 'Arrastra o haz click';
  }, [label, isDragging, disabled]);

  const displayHint = useMemo(() => {
    if (hint) return hint;
    return allowedExtensions.map((e) => e.toUpperCase()).join(' · ');
  }, [hint, allowedExtensions]);

  const iconColor = isDragging && !disabled
    ? 'var(--accent)'
    : 'var(--text-secondary)';

  // ═══════════════════════════════════
  // Procesado de archivos
  // ═══════════════════════════════════

  const processFiles = useCallback(
    (raw: FileList) => {
      const { valid, rejected } = validateFiles(
        raw,
        allowedExtensions,
        maxFiles,
        maxSizeMB
      );

      if (rejected.length > 0) {
        setRejectedFiles(rejected);
        onRejectedRef.current?.(rejected);

        if (rejectTimeoutRef.current !== null) {
          window.clearTimeout(rejectTimeoutRef.current);
        }

        rejectTimeoutRef.current = window.setTimeout(() => {
          if (isMountedRef.current) setRejectedFiles([]);
          rejectTimeoutRef.current = null;
        }, REJECT_DISPLAY_MS);
      }

      if (valid.length > 0) {
        onFilesDroppedRef.current(filesToFileList(valid));
      }
    },
    [allowedExtensions, maxFiles, maxSizeMB]
  );

  // ═══════════════════════════════════
  // Drag handlers
  // ═══════════════════════════════════

  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      dragCounterRef.current += 1;
      setIsDragging(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) setIsDragging(false);
    },
    [disabled]
  );

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    },
    [disabled]
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDragging(false);

      if (e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [disabled, processFiles]
  );

  // ═══════════════════════════════════
  // Click + teclado
  // ═══════════════════════════════════

  const openFileDialog = useCallback(() => {
    if (disabled) return;
    inputRef.current?.click();
  }, [disabled]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openFileDialog();
      }
    },
    [disabled, openFileDialog]
  );

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) {
        processFiles(e.target.files);
      }
      e.target.value = '';
    },
    [processFiles]
  );

  // ═══════════════════════════════════
  // className memoizado
  // ═══════════════════════════════════

  const className = useMemo(() => {
    const parts = ['dropzone'];
    if (isDragging && !disabled) parts.push('dragging');
    if (disabled) parts.push('is-disabled');
    return parts.join(' ');
  }, [isDragging, disabled]);

  // ═══════════════════════════════════
  // Render
  // ═══════════════════════════════════

  return (
    <div
      className={className}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Importar archivos de audio"
      aria-disabled={disabled || undefined}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={openFileDialog}
      onKeyDown={handleKeyDown}
    >
      <input
        ref={inputRef}
        type="file"
        accept={acceptString}
        multiple
        hidden
        aria-hidden="true"
        tabIndex={-1}
        onChange={handleInputChange}
      />

      <Icon
        name="upload"
        size={22}
        color={iconColor}
        aria-hidden="true"
      />

      <div className="dropzone-text">{displayLabel}</div>
      <div className="dropzone-hint">{displayHint}</div>

      {rejectedFiles.length > 0 && (
        <div className="dropzone-error" role="alert" aria-live="assertive">
          <span>Rechazado:</span>
          <ul>
            {rejectedFiles.map((r, i) => (
              <li key={`${r.name}-${i}`}>{formatRejectReason(r)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}