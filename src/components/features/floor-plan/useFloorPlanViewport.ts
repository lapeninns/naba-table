'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useMediaQuery } from '@/hooks/useMediaQuery';

import { expandContentFrame, fitToViewport, zoomAtPoint } from './domain/viewport';

import type { ContentFrame, ViewTransform } from './domain/viewport';
import type { PointerEvent as ReactPointerEvent } from 'react';

const ZOOM_STEP = 1.2;
const WHEEL_STEP = 1.1;

// useLayoutEffect warns during SSR; fall back to useEffect on the server so the
// initial fit still avoids a paint flash on the client without the warning.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export type UseFloorPlanViewportOptions = { contentW: number; contentH: number };

/**
 * Owns the floor-map pan/zoom transform (scale + translate) plus the wheel, drag-pan,
 * and fit handlers. The transform string is applied to a wrapper at the viewport's
 * top-left; the drag handoff inverts it via `screenToContent` (see FloorPlanCanvas).
 */
export function useFloorPlanViewport({ contentW, contentH }: UseFloorPlanViewportOptions) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState<ViewTransform>({ scale: 1, tx: 0, ty: 0 });
  const [frame, setFrame] = useState<ContentFrame>({
    frameW: contentW,
    frameH: contentH,
    padX: 0,
    padY: 0,
  });

  // Latest view for pointerdown reads without re-creating the handler each pan tick.
  const viewRef = useRef(view);
  viewRef.current = view;
  const panRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    tx: number;
    ty: number;
  } | null>(null);
  const didFitRef = useRef(false);
  const userAdjustedRef = useRef(false);

  // Below lg the canvas hands touch to the browser (touch-action: pan-y pinch-zoom), so a JS
  // touch-pan here would fight native page scroll. Mouse/pen drag-pan at any size; touch pans
  // only at lg+ where touch-action is none (e.g. a desktop touchscreen).
  const isDesktop = useMediaQuery('(min-width: 1024px)', true);
  const isDesktopRef = useRef(isDesktop);
  isDesktopRef.current = isDesktop;

  const transform = `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`;

  const fit = useCallback(() => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return false;
    const nextFrame = expandContentFrame(contentW, contentH, rect.width, rect.height);
    setFrame(nextFrame);
    setView(fitToViewport(nextFrame.frameW, nextFrame.frameH, rect.width, rect.height));
    return true;
  }, [contentW, contentH]);

  const zoomBy = useCallback((factor: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    userAdjustedRef.current = true;
    setView((v) => zoomAtPoint(v, factor, rect.width / 2, rect.height / 2));
  }, []);

  const zoomIn = useCallback(() => zoomBy(ZOOM_STEP), [zoomBy]);
  const zoomOut = useCallback(() => zoomBy(1 / ZOOM_STEP), [zoomBy]);

  // Cursor-anchored wheel zoom. Attached imperatively with { passive: false } because
  // React's synthetic onWheel is passive in many setups, so preventDefault would no-op.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      userAdjustedRef.current = true;
      const rect = el.getBoundingClientRect();
      const factor = e.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP;
      setView((v) => zoomAtPoint(v, factor, e.clientX - rect.left, e.clientY - rect.top));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Re-fit when the viewport resizes so the content frame keeps the viewport aspect ratio.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => {
      if (!userAdjustedRef.current) fit();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  // Fit once, on the first frame the viewport has a measured width (tables present).
  // Not on every contentW/H change — that fires mid-drag (bounds shift) and would
  // reset the user's zoom/pan. The Fit button re-fits on demand.
  useIsoLayoutEffect(() => {
    if (didFitRef.current) return;
    if (fit()) didFitRef.current = true;
  }, [fit]);

  const onPanPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    // On phones/tablets let the browser own touch (native vertical scroll + pinch-zoom);
    // a JS pan would trap the page. Mouse/pen still drag-pan at any breakpoint.
    if (!isDesktopRef.current && e.pointerType === 'touch') return;
    // Tables and the zoom controls are buttons that stop propagation / sit above;
    // only an empty-floor press should start a pan.
    if ((e.target as HTMLElement).closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const v = viewRef.current;
    panRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      tx: v.tx,
      ty: v.ty,
    };
  }, []);

  const onPanPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== e.pointerId) return;
    userAdjustedRef.current = true;
    setView((v) => ({
      ...v,
      tx: pan.tx + (e.clientX - pan.startX),
      ty: pan.ty + (e.clientY - pan.startY),
    }));
  }, []);

  const onPanPointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (panRef.current?.pointerId === e.pointerId) panRef.current = null;
  }, []);

  const reset = useCallback(() => {
    userAdjustedRef.current = false;
    fit();
  }, [fit]);

  return {
    viewportRef,
    view,
    frame,
    transform,
    zoomIn,
    zoomOut,
    reset,
    onPanPointerDown,
    onPanPointerMove,
    onPanPointerUp,
  };
}
