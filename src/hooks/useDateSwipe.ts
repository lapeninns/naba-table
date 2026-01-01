import { useEffect, useRef } from 'react';

interface SwipeConfig {
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    threshold?: number;
    enabled?: boolean;
}

interface TouchState {
    startX: number;
    startY: number;
    startTime: number;
}

/**
 * Hook to detect horizontal swipe gestures on touch devices
 * 
 * @param config - Swipe configuration
 * @returns Ref to attach to the swipeable element
 * 
 * @example
 * const swipeRef = useDateSwipe({
 *   onSwipeLeft: () => handleShiftDate(1),
 *   onSwipeRight: () => handleShiftDate(-1),
 * });
 * 
 * return <div ref={swipeRef}>...</div>
 */
export function useDateSwipe<T extends HTMLElement = HTMLElement>(
    config: SwipeConfig
) {
    const {
        onSwipeLeft,
        onSwipeRight,
        threshold = 50,
        enabled = true,
    } = config;

    const ref = useRef<T>(null);
    const touchState = useRef<TouchState | null>(null);

    useEffect(() => {
        if (!enabled) return;

        const element = ref.current;
        if (!element) return;

        // Feature detection: only run on touch-capable devices
        if (!('ontouchstart' in window)) return;

        const handleTouchStart = (e: TouchEvent) => {
            // Only handle single-finger touches
            if (e.touches.length !== 1) return;

            const touch = e.touches[0];
            touchState.current = {
                startX: touch.clientX,
                startY: touch.clientY,
                startTime: Date.now(),
            };
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!touchState.current || e.touches.length !== 1) return;

            const touch = e.touches[0];
            const deltaX = touch.clientX - touchState.current.startX;
            const deltaY = touch.clientY - touchState.current.startY;

            // Detect if movement is predominantly horizontal
            const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);

            // If horizontal swipe detected and threshold met, prevent default scroll
            if (isHorizontal && Math.abs(deltaX) > 10) {
                // Only prevent if we're sure it's a swipe, not a scroll
                e.preventDefault();
            }
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (!touchState.current) return;

            const touch = e.changedTouches[0];
            const deltaX = touch.clientX - touchState.current.startX;
            const deltaY = touch.clientY - touchState.current.startY;

            // Check if it's a horizontal swipe (not vertical scroll)
            const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
            const meetsThreshold = Math.abs(deltaX) >= threshold;

            if (isHorizontal && meetsThreshold) {
                if (deltaX > 0 && onSwipeRight) {
                    // Swipe right (show previous date)
                    onSwipeRight();
                } else if (deltaX < 0 && onSwipeLeft) {
                    // Swipe left (show next date)
                    onSwipeLeft();
                }
            }

            touchState.current = null;
        };

        // Add passive: false to allow preventDefault on touchmove
        element.addEventListener('touchstart', handleTouchStart, { passive: true });
        element.addEventListener('touchmove', handleTouchMove, { passive: false });
        element.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            element.removeEventListener('touchstart', handleTouchStart);
            element.removeEventListener('touchmove', handleTouchMove);
            element.removeEventListener('touchend', handleTouchEnd);
        };
    }, [enabled, onSwipeLeft, onSwipeRight, threshold]);

    return ref;
}
