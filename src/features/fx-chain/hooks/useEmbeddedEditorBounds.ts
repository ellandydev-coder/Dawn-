// src/features/fx-chain/hooks/useEmbeddedEditorBounds.ts

import { useEffect, useRef, type RefObject } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { vst3Bridge } from '@audio/plugins/vst3';

export function useEmbeddedEditorBounds(
  containerRef: RefObject<HTMLDivElement | null>,
  bundlePath: string,
  instanceId: string
) {
  const isOpenedRef = useRef<boolean>(false);
  const isOpeningRef = useRef<boolean>(false);
  const lastBoundsRef = useRef<{ x: number; y: number; w: number; h: number }>({
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  });
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const checkAndSyncBounds = async () => {
      if (!containerRef.current || cancelled) return;
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
          await vst3Bridge.ensureInstance(bundlePath, instanceId);
          if (cancelled) {
            isOpeningRef.current = false;
            return;
          }

          const res = await invoke<{ success: boolean; message: string }>('vst3_open_editor', {
            pluginKey: bundlePath,
            instanceId,
            x,
            y,
            width: w,
            height: h,
          });

          if (cancelled) {
            isOpeningRef.current = false;
            if (res.success) {
              invoke('vst3_close_editor', { pluginKey: bundlePath, instanceId }).catch(() => {});
            }
            return;
          }

          if (res.success) {
            isOpenedRef.current = true;
            console.info('[useEmbeddedEditorBounds] Editor VST3 abierto:', res.message);
          } else {
            console.warn('[useEmbeddedEditorBounds] Error abriendo editor VST3:', res.message);
          }
        } catch (e) {
          console.error('[useEmbeddedEditorBounds] Excepción abriendo editor nativo:', e);
        } finally {
          isOpeningRef.current = false;
        }
      } else if (isOpenedRef.current && hasMovedOrResized) {
        lastBoundsRef.current = { x, y, w, h };
        invoke('vst3_update_editor_bounds', {
          pluginKey: bundlePath,
          instanceId,
          x,
          y,
          width: w,
          height: h,
        }).catch(() => {});
      }
    };

    const loop = () => {
      checkAndSyncBounds();
      animFrameRef.current = requestAnimationFrame(loop);
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
        invoke('vst3_close_editor', { pluginKey: bundlePath, instanceId }).catch(() => {});
      }
    };
  }, [containerRef, bundlePath, instanceId]);
}
