// src/features/fx-chain/hooks/useEmbeddedEditorBounds.ts

import { useEffect, useRef, useState, type RefObject } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { vst3Bridge } from '@audio/plugins/vst3';

export function useEmbeddedEditorBounds(
  containerRef: RefObject<HTMLDivElement | null>,
  bundlePath: string,
  instanceId: string
) {
  const [hasFailed, setHasFailed] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isOpenedRef = useRef<boolean>(false);
  const isOpeningRef = useRef<boolean>(false);
  const lastBoundsRef = useRef<{ x: number; y: number; w: number; h: number }>({
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  });
  const animFrameRef = useRef<number | null>(null);
  const pluginKeyRef = useRef<string | null>(null);
  const hasFailedRefSync = useRef<boolean>(false);

  useEffect(() => {
    hasFailedRefSync.current = hasFailed;
  }, [hasFailed]);

  useEffect(() => {
    let cancelled = false;
    setHasFailed(false);
    setErrorMessage(null);

    const checkAndSyncBounds = async () => {
      if (!containerRef.current || cancelled || hasFailedRefSync.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      if (rect.width === 0 || rect.height === 0) return;

      const scale = window.devicePixelRatio || 1;
      const x = Math.round(rect.left * scale);
      const y = Math.round(rect.top * scale);
      const w = Math.round(rect.width * scale);
      const h = Math.round(rect.height * scale);

      const last = lastBoundsRef.current;
      const hasMovedOrResized = x !== last.x || y !== last.y || w !== last.w || h !== last.h;

      if (!isOpenedRef.current && !isOpeningRef.current) {
        isOpeningRef.current = true;
        lastBoundsRef.current = { x, y, w, h };
        try {
          const pluginKey = await vst3Bridge.ensureInstance(bundlePath, instanceId);
          pluginKeyRef.current = pluginKey;
          if (cancelled) {
            isOpeningRef.current = false;
            return;
          }

          const res = await invoke<{ success: boolean; message: string }>('vst3_open_editor', {
            pluginKey,
            instanceId,
            x,
            y,
            width: w,
            height: h,
          });

          if (cancelled) {
            isOpeningRef.current = false;
            if (res.success) {
              invoke('vst3_close_editor', { pluginKey: pluginKeyRef.current ?? bundlePath, instanceId }).catch(() => {});
            }
            return;
          }

          if (res.success) {
            isOpenedRef.current = true;
          } else {
            setHasFailed(true);
            setErrorMessage(res.message);
          }
        } catch (e) {
          setHasFailed(true);
          const msg = e instanceof Error ? e.message : String(e);
          setErrorMessage(msg);
        } finally {
          isOpeningRef.current = false;
        }
      } else if (isOpenedRef.current && hasMovedOrResized) {
        lastBoundsRef.current = { x, y, w, h };
        invoke('vst3_update_editor_bounds', {
          pluginKey: pluginKeyRef.current ?? bundlePath,
          instanceId,
          x,
          y,
          width: w,
          height: h,
        }).catch(() => {});
      }
    };

    const loop = () => {
      if (hasFailedRefSync.current) {
        return;
      }
      checkAndSyncBounds();
      if (!hasFailedRefSync.current) {
        animFrameRef.current = requestAnimationFrame(loop);
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (isOpenedRef.current || isOpeningRef.current) {
        isOpenedRef.current = false;
        isOpeningRef.current = false;
        invoke('vst3_close_editor', { pluginKey: pluginKeyRef.current ?? bundlePath, instanceId }).catch(() => {});
      }
    };
  }, [containerRef, bundlePath, instanceId]);

  return { hasFailed, errorMessage };
}