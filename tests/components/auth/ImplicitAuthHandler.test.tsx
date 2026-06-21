import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ImplicitAuthHandler } from '../../../components/auth/ImplicitAuthHandler';

describe('ImplicitAuthHandler', () => {
  it('clears token-bearing URL fragments without installing a session', async () => {
    window.history.replaceState(
      {},
      '',
      '/auth/signin?redirectedFrom=%2Fguest%2Fdashboard#access_token=attacker&refresh_token=secret',
    );

    render(<ImplicitAuthHandler defaultRedirect="/guest/dashboard" />);

    await waitFor(() => {
      expect(window.location.hash).toBe('');
    });
    expect(window.location.pathname).toBe('/auth/signin');
    expect(window.location.search).toBe('?redirectedFrom=%2Fguest%2Fdashboard');
  });

  it('leaves unrelated hash anchors untouched', () => {
    window.history.replaceState({}, '', '/auth/signin#signin-panel');

    render(<ImplicitAuthHandler defaultRedirect="/guest/dashboard" />);

    expect(window.location.hash).toBe('#signin-panel');
  });
});
