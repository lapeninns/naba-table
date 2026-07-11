import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { ReserveRootLayout } from '@pages/RootLayout';

describe('ReserveRootLayout', () => {
  it('wraps routed content with providers and a skip link @smoke @a11y', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<ReserveRootLayout />}>
            <Route index element={<p>routed page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute(
      'href',
      '#reserve-content',
    );
    expect(screen.getByText('routed page')).toBeInTheDocument();
    expect(document.getElementById('reserve-content')).toContainElement(
      screen.getByText('routed page'),
    );
  });
});
