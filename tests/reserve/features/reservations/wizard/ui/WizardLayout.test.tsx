import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { WizardLayout } from '@features/reservations/wizard/ui/WizardLayout';

describe('WizardLayout', () => {
  it('renders children inside a main landmark by default @smoke', () => {
    render(
      <WizardLayout>
        <p>wizard body</p>
      </WizardLayout>,
    );

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByText('wizard body')).toBeInTheDocument();
  });

  it('can render as a plain div for embedded surfaces @smoke', () => {
    render(
      <WizardLayout elementType="div" surface="ops">
        <p>ops body</p>
      </WizardLayout>,
    );

    expect(screen.queryByRole('main')).not.toBeInTheDocument();
    expect(screen.getByText('ops body')).toBeInTheDocument();
  });

  it('shows the restaurant hero header when a name is provided @smoke', () => {
    render(
      <WizardLayout restaurantName="The Old Crown">
        <p>body</p>
      </WizardLayout>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'The Old Crown' })).toBeInTheDocument();
    expect(screen.getByText('Live availability')).toBeInTheDocument();
    expect(screen.getByText('Instant confirmation')).toBeInTheDocument();
  });

  it('renders banner and footer slots @smoke', () => {
    render(
      <WizardLayout banner={<p>offline banner</p>} footer={<p>sticky footer</p>}>
        <p>body</p>
      </WizardLayout>,
    );

    expect(screen.getByText('offline banner')).toBeInTheDocument();
    expect(screen.getByText('sticky footer')).toBeInTheDocument();
  });

  it('reserves scroll space for the sticky footer when visible @contract', () => {
    render(
      <WizardLayout stickyVisible stickyHeight={72}>
        <p>body</p>
      </WizardLayout>,
    );

    expect(screen.getByRole('main').style.paddingBottom).toContain('72px');
  });
});
