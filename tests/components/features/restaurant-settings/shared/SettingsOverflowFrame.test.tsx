import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SettingsOverflowFrame } from '@/components/features/restaurant-settings/shared/SettingsOverflowFrame';
import { SettingsSectionNav } from '@/components/features/restaurant-settings/shared/SettingsSectionNav';
import {
  revealSettingsActiveItem,
  settingsOverflowEdges,
} from '@/components/features/restaurant-settings/shared/useSettingsHorizontalOverflow';

function stubScrollMetrics(
  element: HTMLElement,
  { clientWidth, scrollWidth }: { clientWidth: number; scrollWidth: number },
) {
  Object.defineProperty(element, 'clientWidth', { configurable: true, value: clientWidth });
  Object.defineProperty(element, 'scrollWidth', { configurable: true, value: scrollWidth });
}

function rect(left: number, width: number): DOMRect {
  return {
    left,
    right: left + width,
    width,
    top: 0,
    bottom: 44,
    height: 44,
    x: left,
    y: 0,
    toJSON: () => ({}),
  };
}

describe('settingsOverflowEdges', () => {
  it('@contract reports only the sides that hide content', () => {
    expect(settingsOverflowEdges({ scrollLeft: 0, clientWidth: 200, scrollWidth: 200 })).toEqual({
      start: false,
      end: false,
    });
    expect(settingsOverflowEdges({ scrollLeft: 0, clientWidth: 120, scrollWidth: 320 })).toEqual({
      start: false,
      end: true,
    });
    expect(settingsOverflowEdges({ scrollLeft: 60, clientWidth: 120, scrollWidth: 320 })).toEqual({
      start: true,
      end: true,
    });
    expect(settingsOverflowEdges({ scrollLeft: 200, clientWidth: 120, scrollWidth: 320 })).toEqual({
      start: true,
      end: false,
    });
  });
});

describe('revealSettingsActiveItem', () => {
  it('@contract scrolls sideways just past an item hidden on the end side', () => {
    const scroller = document.createElement('div');
    const active = document.createElement('a');
    scroller.append(active);
    scroller.getBoundingClientRect = () => rect(0, 200);
    active.getBoundingClientRect = () => rect(180, 80);

    revealSettingsActiveItem(scroller, active);

    expect(scroller.scrollLeft).toBe(60 + 24);
  });

  it('@contract scrolls back to an item hidden on the start side, never below zero', () => {
    const scroller = document.createElement('div');
    const active = document.createElement('a');
    scroller.append(active);
    scroller.scrollLeft = 100;
    scroller.getBoundingClientRect = () => rect(0, 200);
    active.getBoundingClientRect = () => rect(-40, 80);

    revealSettingsActiveItem(scroller, active);

    expect(scroller.scrollLeft).toBe(36);
  });

  it('@contract leaves a fully visible item alone', () => {
    const scroller = document.createElement('div');
    const active = document.createElement('a');
    scroller.append(active);
    scroller.scrollLeft = 10;
    scroller.getBoundingClientRect = () => rect(0, 200);
    active.getBoundingClientRect = () => rect(40, 80);

    revealSettingsActiveItem(scroller, active);

    expect(scroller.scrollLeft).toBe(10);
  });
});

describe('SettingsOverflowFrame', () => {
  it('@a11y @contract shows an edge fade on each side that hides tabs, and none when they fit', () => {
    const { container, rerender } = render(
      <SettingsOverflowFrame revealKey="a">
        <div role="tablist" aria-label="Variants" data-testid="strip">
          <span role="tab" aria-selected="true">
            Request received
          </span>
          <span role="tab" aria-selected="false">
            Checking availability
          </span>
        </div>
      </SettingsOverflowFrame>,
    );

    const frame = container.querySelector('[data-slot="settings-overflow-frame"]');
    expect(frame).toHaveClass('relative', 'min-w-0');
    expect(container.querySelectorAll('[data-slot="settings-overflow-fade"]')).toHaveLength(0);

    const strip = screen.getByTestId('strip');
    stubScrollMetrics(strip, { clientWidth: 200, scrollWidth: 480 });
    act(() => {
      fireEvent.scroll(strip);
    });

    const endFade = container.querySelector('[data-edge="end"]');
    expect(endFade).toHaveAttribute('aria-hidden');
    expect(endFade).toHaveClass('pointer-events-none', 'bg-background', 'border-s');
    expect(container.querySelector('[data-edge="start"]')).toBeNull();

    strip.scrollLeft = 280;
    act(() => {
      fireEvent.scroll(strip);
    });
    expect(container.querySelector('[data-edge="start"]')).toHaveClass('bg-background', 'border-e');
    expect(container.querySelector('[data-edge="end"]')).toBeNull();

    // Decorative only: the fades never add names or tab stops.
    rerender(
      <SettingsOverflowFrame revealKey="b">
        <div role="tablist" aria-label="Variants" data-testid="strip">
          <span role="tab" aria-selected="true">
            Request received
          </span>
        </div>
      </SettingsOverflowFrame>,
    );
    expect(screen.getAllByRole('tab')).toHaveLength(1);
  });
});

describe('SettingsSectionNav overflow', () => {
  it('@contract fades the rail edge that hides sections (inline dock)', () => {
    const { container } = render(
      <SettingsSectionNav
        title="Sections on this page"
        dock="inline"
        items={[
          { label: 'Business status', targetId: 'status', isActive: true },
          { label: 'Categories', targetId: 'categories' },
          { label: 'Links', targetId: 'links' },
          { label: 'Amenities', targetId: 'amenities' },
        ]}
      />,
    );

    const list = container.querySelector<HTMLElement>('[role="list"]');
    expect(list).not.toBeNull();
    if (!list) return;
    expect(list.className).toContain('[@media(max-height:500px)]:py-0');

    stubScrollMetrics(list, { clientWidth: 320, scrollWidth: 620 });
    act(() => {
      fireEvent.scroll(list);
    });

    expect(container.querySelector('[data-edge="end"]')).toBeInTheDocument();
    expect(container.querySelector('[data-edge="start"]')).toBeNull();
  });
});
