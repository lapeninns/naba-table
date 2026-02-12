import { useCallback, useEffect, useRef, useState } from 'react';

type Pan = { x: number; y: number };

export function usePanZoom({
  initialZoom = 0.75,
  initialPan = { x: 0, y: 0 },
  canStartPan,
  onPanStart,
}: {
  initialZoom?: number;
  initialPan?: Pan;
  canStartPan: (target: HTMLElement | null) => boolean;
  onPanStart?: () => void;
}) {
  const initialRef = useRef({ zoom: initialZoom, pan: initialPan });
  const [zoom, setZoom] = useState(initialZoom);
  const [pan, setPan] = useState<Pan>(initialPan);
  const [isDragging, setIsDragging] = useState(false);

  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef<Pan>({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);

  const rafIdRef = useRef<number | null>(null);
  const pendingPanRef = useRef<Pan | null>(null);

  const flushPan = useCallback(() => {
    if (!pendingPanRef.current) return;
    setPan(pendingPanRef.current);
    pendingPanRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  const schedulePan = useCallback((next: Pan) => {
    pendingPanRef.current = next;
    if (rafIdRef.current !== null) return;
    rafIdRef.current = window.requestAnimationFrame(() => {
      rafIdRef.current = null;
      flushPan();
    });
  }, [flushPan]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement | null;
      if (!canStartPan(target)) return;

      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);
      hasDraggedRef.current = false;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      panStartRef.current = pan;
      onPanStart?.();
    },
    [canStartPan, onPanStart, pan],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        hasDraggedRef.current = true;
      }

      schedulePan({ x: panStartRef.current.x + dx, y: panStartRef.current.y + dy });
    },
    [isDragging, schedulePan],
  );

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    // Ensure the final position is committed even if rAF is pending.
    if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    flushPan();
    setIsDragging(false);
  }, [flushPan]);

  const zoomIn = useCallback(() => setZoom((z) => Math.min(2, z + 0.1)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(0.5, z - 0.1)), []);
  const panBy = useCallback((dx: number, dy: number) => {
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  }, []);
  const resetView = useCallback(() => {
    setZoom(initialRef.current.zoom);
    setPan(initialRef.current.pan);
    hasDraggedRef.current = false;
  }, []);

  return {
    zoom,
    setZoom,
    pan,
    setPan,
    isDragging,
    hasDraggedRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    zoomIn,
    zoomOut,
    panBy,
    resetView,
  };
}
