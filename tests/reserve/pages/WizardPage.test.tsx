import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import WizardPage from '@pages/WizardPage';

const wizardSpy = vi.hoisted(() => vi.fn());
vi.mock('@features/reservations/wizard/ui/ReservationWizard', () => ({
  ReservationWizard: (props: Record<string, unknown>) => {
    wizardSpy(props);
    return <p>reservation-wizard-stub</p>;
  },
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route index element={<WizardPage />} />
        <Route path="r/:slug" element={<WizardPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  wizardSpy.mockClear();
});

describe('WizardPage', () => {
  it('seeds the wizard with the restaurant slug from the route @contract @smoke', () => {
    renderAt('/r/the-old-crown');

    expect(screen.getByText('reservation-wizard-stub')).toBeInTheDocument();
    expect(wizardSpy).toHaveBeenCalledWith(
      expect.objectContaining({ initialDetails: { restaurantSlug: 'the-old-crown' } }),
    );
  });

  it('trims whitespace from the slug parameter @contract', () => {
    renderAt('/r/%20the-old-crown%20');

    expect(wizardSpy).toHaveBeenCalledWith(
      expect.objectContaining({ initialDetails: { restaurantSlug: 'the-old-crown' } }),
    );
  });

  it('starts without initial details when no slug exists @contract', () => {
    renderAt('/');

    expect(wizardSpy).toHaveBeenCalledWith(
      expect.objectContaining({ initialDetails: undefined }),
    );
  });
});
