import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import ReservationDetailsPage from '@pages/ReservationDetailsPage';

describe('ReservationDetailsPage', () => {
  it('shows the reservation id from the route @smoke', () => {
    render(
      <MemoryRouter initialEntries={['/res-42']}>
        <Routes>
          <Route path=":reservationId" element={<ReservationDetailsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Reservation res-42' })).toBeInTheDocument();
    expect(screen.getByText(/Details view coming soon/)).toBeInTheDocument();
  });
});
