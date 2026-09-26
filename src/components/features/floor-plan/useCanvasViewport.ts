'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export type ViewTransform = { scale: number; x: number; y: number; fit: boolean };

const MIN_SCALE = 0.3;
const MAX_SCALE = 2.5;
const MAX_FIT_SCALE = 1.25;

type Bounds = { x: number; y: number; w: number; h: number };

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/** Scale-and-translate that zooms around a point, keeping it fixed on screen. */
export function zoomAround(
  view: ViewTransform,
  factor: number,
  cx: number,
  cy: number,
): ViewTransform {
  const scale = clampScale(view.scale * factor);
  const ratio = scale / view.scale;
  return { scale, x: cx - (cx - view.x) * ratio, y: cy - (cy - view.y) * ratio, fit: false };
}

export function fitTransform(
  viewport: { width: number; height: number },
  bounds: Bounds,
): ViewTransform {
  const scale = Math.min(
    (viewport.width - 16) / bounds.w,
    (viewport.height - 16) / bounds.h,
    MAX_FIT_SCALE,
  );
  const safe = Number.isFinite(scale) && scale > 0 ? clampScale(scale) : 1;
  return {
    scale: safe,
    x: (viewport.width - bounds.w * safe) / 2 - bounds.x * safe,
    y: (viewport.height - bounds.h * safe) / 2 - bounds.y * safe,
    fit: true,
  };
}

/**
 * Pan (drag or wheel), zoom (ctrl/cmd + wheel, pinch, buttons) and fit-to-view
 * for the plan canvas. Pointer handling for tables lives with the tables; this
 * hook only owns background gestures, so it can tell a pan from a tap.
 */
export function useCanvasViewport(bounds: Bounds | null) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState<ViewTransform>({ scale: 1, x: 0, y: 0, fit: true });
  const [isPanning, setIsPanning] = useState(false);
  const viewRef = useRef(view);
  viewRef.current = view;
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<
    | { type: 'pan'; sx: number; sy: number; ox: number; oy: number; moved: boolean }
    | { type: 'pinch'; d0: number; start: ViewTransform; cx: number; cy: number }
    | null
  >(null);

  const fit = useCallback(() => {
    const el = viewportRef.current;
    const b = boundsRef.current;
    if (!el || !b) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    setView(fitTransform(rect, b));
  }, []);

  const boundsKey = bounds ? `${bounds.x}:${bounds.y}:${bounds.w}:${bounds.h}` : '';
  useLayoutEffect(() => {
    if (view.fit) fit();
    // Refit when the content bounds change (zone filter, layout) while fitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundsKey, fit]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setView((current) => {
        if (!current.fit) return current;
        const b = boundsRef.current;
        const rect = el.getBoundingClientRect();
        return b && rect.width && rect.height ? fitTransform(rect, b) : current;
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Wheel needs a non-passive listener to stop the page scrolling.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      if (event.ctrlKey || event.metaKey) {
        const factor = event.deltaY < 0 ? 1.1 : 0.9;
        setView((current) =>
          zoomAround(current, factor, event.clientX - rect.left, event.clientY - rect.top),
        );
      } else {
        setView((current) => ({
          ...current,
          x: current.x - event.deltaX,
          y: current.y - event.deltaY,
          fit: false,
        }));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const zoomBy = useCallback((factor: number) => {
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setView((current) => zoomAround(current, factor, rect.width / 2, rect.height / 2));
  }, []);

  /** Background pointer-down. Returns handlers; a tap (no movement) calls onTap. */
  const onBackgroundPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, onTap?: () => void) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      const el = viewportRef.current;
      if (!el) return;
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const rect = el.getBoundingClientRect();

      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()] as [
          { x: number; y: number },
          { x: number; y: number },
        ];
        gesture.current = {
          type: 'pinch',
          d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
          start: viewRef.current,
          cx: (a.x + b.x) / 2 - rect.left,
          cy: (a.y + b.y) / 2 - rect.top,
        };
      } else {
        const current = viewRef.current;
        gesture.current = {
          type: 'pan',
          sx: event.clientX,
          sy: event.clientY,
          ox: current.x,
          oy: current.y,
          moved: false,
        };
      }

      const onMove = (e: PointerEvent) => {
        if (pointers.current.has(e.pointerId))
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const g = gesture.current;
        if (!g) return;
        if (g.type === 'pinch') {
          if (pointers.current.size < 2) return;
          const [a, b] = [...pointers.current.values()] as [
            { x: number; y: number },
            { x: number; y: number },
          ];
          const factor = Math.hypot(a.x - b.x, a.y - b.y) / g.d0;
          setView(zoomAround(g.start, factor, g.cx, g.cy));
          return;
        }
        const dx = e.clientX - g.sx;
        const dy = e.clientY - g.sy;
        if (!g.moved && Math.hypot(dx, dy) < 6) return;
        if (!g.moved) {
          g.moved = true;
          setIsPanning(true);
        }
        setView((current) => ({ ...current, x: g.ox + dx, y: g.oy + dy, fit: false }));
      };
      const onUp = (e: PointerEvent) => {
        pointers.current.delete(e.pointerId);
        if (gesture.current?.type === 'pinch' && pointers.current.size > 0) return;
        const g = gesture.current;
        gesture.current = null;
        setIsPanning(false);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        if (g?.type === 'pan' && !g.moved) onTap?.();
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [],
  );

  return { viewportRef, view, isPanning, fit, zoomBy, onBackgroundPointerDown };
}
