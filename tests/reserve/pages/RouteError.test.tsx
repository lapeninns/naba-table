import { render, screen } from '@testing-library/react';
import React from 'react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { ReserveErrorBoundary } from '@pages/RouteError';

function renderWithLoaderError(thrown: unknown) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <p>never rendered</p>,
        errorElement: <ReserveErrorBoundary />,
        loader: () => {
          throw thrown;
        },
      },
    ],
    { initialEntries: ['/'] },
  );
  return render(<RouterProvider router={router} />);
}

describe('ReserveErrorBoundary', () => {
  it('renders the generic fallback for unexpected errors @smoke', async () => {
    renderWithLoaderError(new Error('boom'));

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Please refresh the page or try again shortly.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('names route error responses by status @contract', async () => {
    renderWithLoaderError(new Response(null, { status: 404, statusText: 'Not Found' }));

    expect(await screen.findByText('404 Not Found')).toBeInTheDocument();
  });
});
