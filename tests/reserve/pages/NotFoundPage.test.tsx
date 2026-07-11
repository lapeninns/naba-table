import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import NotFoundPage from '@pages/NotFoundPage';

describe('NotFoundPage', () => {
  it('explains the missing page and links back to the reservation flow @smoke', () => {
    render(
      <MemoryRouter initialEntries={['/missing']}>
        <NotFoundPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    const backLink = screen.getByRole('link', { name: 'Return to reservations' });
    expect(backLink).toHaveAttribute('href', '/');
  });
});
