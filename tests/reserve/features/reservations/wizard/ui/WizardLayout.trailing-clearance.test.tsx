import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { WizardLayout } from '@features/reservations/wizard/ui/WizardLayout';

describe('WizardLayout trailing focus clearance', () => {
  it('reserves three touch targets beyond the measured guest rail @contract', () => {
    // Given / When
    render(
      <WizardLayout stickyVisible stickyHeight={124}>
        <textarea aria-label="Reservation notes" />
      </WizardLayout>,
    );

    // Then
    const padding = screen.getByRole('main').style.paddingBottom;
    expect(padding).toContain('var(--pg-touch-target) * 3');
    expect(padding).toContain('124px');
    expect(padding).toContain('safe-area-inset-bottom');
  });

  it('keeps embedded ops clearance at one responsive grid gap @contract', () => {
    // Given / When
    const { container } = render(
      <WizardLayout elementType="div" surface="ops" stickyVisible stickyHeight={124}>
        <textarea aria-label="Reservation notes" />
      </WizardLayout>,
    );

    // Then
    const padding = container.firstElementChild?.getAttribute('style');
    expect(padding).toContain('var(--pg-grid-gap)');
    expect(padding).not.toContain('var(--pg-touch-target)');
    expect(padding).toContain('124px');
    expect(padding).toContain('safe-area-inset-bottom');
  });
});
