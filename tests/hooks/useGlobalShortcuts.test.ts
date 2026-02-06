import { render } from '@testing-library/react';
import React, { useMemo } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useGlobalShortcuts } from '@src/hooks/useGlobalShortcuts';

type Props = {
  shortcuts: Parameters<typeof useGlobalShortcuts>[0];
};

function Harness({ shortcuts }: Props) {
  // Avoid re-register churn from inline arrays in tests.
  const stable = useMemo(() => shortcuts, [shortcuts]);
  useGlobalShortcuts(stable);
  return null;
}

describe('useGlobalShortcuts', () => {
  it('triggers on metaOrCtrl + key (Cmd on macOS)', () => {
    const handler = vi.fn();
    render(
      React.createElement(Harness, {
        shortcuts: [{ key: 'enter', metaOrCtrl: true, handler }],
      }),
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('triggers on metaOrCtrl + key (Ctrl on Windows/Linux)', () => {
    const handler = vi.fn();
    render(
      React.createElement(Harness, {
        shortcuts: [{ key: 'enter', metaOrCtrl: true, handler }],
      }),
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not trigger when extra modifiers are pressed (e.g. shift)', () => {
    const handler = vi.fn();
    render(
      React.createElement(Harness, {
        shortcuts: [{ key: 'enter', metaOrCtrl: true, handler }],
      }),
    );

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, shiftKey: true }),
    );
    expect(handler).toHaveBeenCalledTimes(0);
  });

  it('respects enabled=false', () => {
    const handler = vi.fn();
    render(
      React.createElement(Harness, {
        shortcuts: [{ key: 'enter', metaOrCtrl: true, enabled: false, handler }],
      }),
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true }));
    expect(handler).toHaveBeenCalledTimes(0);
  });

  it('respects when() scoping', () => {
    const handler = vi.fn();
    render(
      React.createElement(Harness, {
        shortcuts: [{ key: 'enter', metaOrCtrl: true, when: () => false, handler }],
      }),
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true }));
    expect(handler).toHaveBeenCalledTimes(0);
  });

  it('does not trigger repeatedly when key is held unless allowRepeat=true', () => {
    const handler = vi.fn();
    const handlerAllowRepeat = vi.fn();
    render(
      React.createElement(Harness, {
        shortcuts: [
          { key: 'enter', metaOrCtrl: true, handler },
          { key: 'enter', metaOrCtrl: true, allowRepeat: true, handler: handlerAllowRepeat },
        ],
      }),
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, repeat: true }));
    expect(handler).toHaveBeenCalledTimes(0);
    expect(handlerAllowRepeat).toHaveBeenCalledTimes(1);
  });
});
