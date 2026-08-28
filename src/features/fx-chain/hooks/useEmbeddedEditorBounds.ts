// src/features/fx-chain/hooks/useEmbeddedEditorBounds.ts

import { useEffect, useRef, type RefObject } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { vst3Bridge } from '@services/plugins/vst3Bridge';

export function useEmbeddedEditorBounds(
  containerRef: RefObject<HTMLDivElement | null>,
  bundlePath: string,
  instanceId: string
) {
  const isOpenedRef = useRef<boolean>(false);
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

      if (!isOpenedRef.current) {
        lastBoundsRef.current = { x, y, w, h };
        try {
          await vst3Bridge.ensureInstance(bundlePath, instanceId);
          if (cancelled) return;

          const res = await invoke<{ success: boolean }>('vst3_open_editor', {
            pluginKey: bundlePath,
            instanceId,
            x,
            y,
            width: w,
            height: h,
          });
          if (res.success) {
            isOpenedRef.current = true;
          }
        } catch (e) {
          console.error('[useEmbeddedEditorBounds] Error abriendo editor nativo:', e);
        }
      } else if (hasMovedOrResized) {
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
      if (isOpenedRef.current) {
        invoke('vst3_close_editor', { pluginKey: bundlePath, instanceId }).catch(() => {});
        isOpenedRef.current = false;
      }
    };
  }, [containerRef, bundlePath, instanceId]);
}