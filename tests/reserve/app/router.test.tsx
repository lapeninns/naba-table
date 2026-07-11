import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReserveRouter } from '@app/router';

// The real route table needs API providers; the router suite only pins that
// the browser router mounts under the configured /reserve basename.
vi.mock('@app/routes', () => ({
  reserveRoutes: [{ path: '/', element: <p>router-home-stub</p> }],
}));

afterEach(() => {
  window.history.replaceState({}, '', '/');
});

describe('ReserveRouter', () => {
  it('serves routes under the /reserve basename @contract @smoke', async () => {
    window.history.replaceState({}, '', '/reserve');

    render(<ReserveRouter />);

    expect(await screen.findByText('router-home-stub')).toBeInTheDocument();
  });
});
