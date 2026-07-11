import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDateSwipe } from '@src/hooks/useDateSwipe';

type SwipeProps = {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  enabled?: boolean;
};

function touchEvent(type: string, x: number, y: number, fingers = 1) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const touch = { clientX: x, clientY: y };
  Object.assign(event, {
    touches: Array.from({ length: fingers }, () => touch),
    changedTouches: [touch],
  });
  return event;
}

function renderSwipe(initial: SwipeProps) {
  const element = document.createElement('div');
  // First render with enabled=false so we can attach the element to the ref
  // before the effect that registers listeners runs.
  const rendered = renderHook((props: SwipeProps) => useDateSwipe<HTMLDivElement>(props), {
    initialProps: { ...initial, enabled: false },
  });
  rendered.result.current.current = element;
  rendered.rerender({ ...initial, enabled: initial.enabled ?? true });
  return { element, ...rendered };
}

function swipe(element: HTMLElement, fromX: number, toX: number, fromY = 100, toY = 100) {
  element.dispatchEvent(touchEvent('touchstart', fromX, fromY));
  element.dispatchEvent(touchEvent('touchend', toX, toY));
}

describe('useDateSwipe', () => {
  beforeEach(() => {
    // Feature detection: the hook only attaches listeners on touch devices.
    (window as unknown as Record<string, unknown>).ontouchstart = null;
  });

  afterEach(() => {
    Reflect.deleteProperty(window, 'ontouchstart');
  });

  it('@contract fires onSwipeLeft for a leftward swipe past the threshold', () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    const { element } = renderSwipe({ onSwipeLeft, onSwipeRight, threshold: 50 });

    swipe(element, 200, 100);

    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('@contract fires onSwipeRight for a rightward swipe past the threshold', () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    const { element } = renderSwipe({ onSwipeLeft, onSwipeRight, threshold: 50 });

    swipe(element, 100, 200);

    expect(onSwipeRight).toHaveBeenCalledTimes(1);
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('@contract ignores swipes below the threshold', () => {
    const onSwipeLeft = vi.fn();
    const { element } = renderSwipe({ onSwipeLeft, threshold: 50 });

    swipe(element, 200, 170);

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('@contract ignores predominantly vertical gestures', () => {
    const onSwipeLeft = vi.fn();
    const { element } = renderSwipe({ onSwipeLeft, threshold: 50 });

    swipe(element, 200, 140, 100, 300);

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('@contract ignores multi-finger touches', () => {
    const onSwipeLeft = vi.fn();
    const { element } = renderSwipe({ onSwipeLeft, threshold: 50 });

    element.dispatchEvent(touchEvent('touchstart', 200, 100, 2));
    element.dispatchEvent(touchEvent('touchend', 100, 100, 2));

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('@contract prevents default scrolling only for horizontal movement', () => {
    const { element } = renderSwipe({ onSwipeLeft: vi.fn(), threshold: 50 });

    element.dispatchEvent(touchEvent('touchstart', 200, 100));
    const horizontal = touchEvent('touchmove', 150, 100);
    element.dispatchEvent(horizontal);
    expect(horizontal.defaultPrevented).toBe(true);

    element.dispatchEvent(touchEvent('touchstart', 200, 100));
    const vertical = touchEvent('touchmove', 200, 40);
    element.dispatchEvent(vertical);
    expect(vertical.defaultPrevented).toBe(false);
  });

  it('@contract detaches listeners when disabled', () => {
    const onSwipeLeft = vi.fn();
    const { element, rerender } = renderSwipe({ onSwipeLeft, threshold: 50 });

    rerender({ onSwipeLeft, threshold: 50, enabled: false });
    swipe(element, 200, 100);

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });
});
