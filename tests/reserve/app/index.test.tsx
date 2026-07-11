import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import ReserveAppDefault, { ReserveApp } from '@app/index';

// The router mounts a browser history against the /reserve basename and is
// covered by its own suite; the app shell only needs to compose it.
vi.mock('@app/router', () => ({
  ReserveRouter: () => <p>reserve-router-stub</p>,
}));

describe('ReserveApp', () => {
  it('renders the reserve router @smoke', () => {
    render(<ReserveApp />);
    expect(screen.getByText('reserve-router-stub')).toBeInTheDocument();
  });

  it('exports the app as the default export @contract', () => {
    expect(ReserveAppDefault).toBe(ReserveApp);
  });
});
