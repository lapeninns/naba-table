import '@testing-library/jest-dom/vitest';

import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useOnlineStatus } from '@/hooks/useOnlineStatus';

const originalNavigator = global.navigator;

describe('useOnlineStatus', () => {
  beforeEach(() => {
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: { onLine: false },
    });
  });

  afterEach(() => {
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: originalNavigator,
    });
  });

  it('returns true during server-side rendering to keep markup stable', () => {
    const Sample = () => <span>{String(useOnlineStatus())}</span>;
    const markup = renderToString(<Sample />);
    expect(markup).toContain('true');
  });

  it('hydrates to the actual online state and reacts to browser events', async () => {
    const Sample = () => <span>{String(useOnlineStatus())}</span>;

    render(<Sample />);

    await waitFor(() => {
      expect(screen.getByText('false')).toBeInTheDocument();
    });

    act(() => {
      Object.defineProperty(global.navigator, 'onLine', {
        configurable: true,
        value: true,
      });
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(screen.getByText('true')).toBeInTheDocument();
    });

    act(() => {
      Object.defineProperty(global.navigator, 'onLine', {
        configurable: true,
        value: false,
      });
      window.dispatchEvent(new Event('offline'));
    });

    await waitFor(() => {
      expect(screen.getByText('false')).toBeInTheDocument();
    });
  });
});
