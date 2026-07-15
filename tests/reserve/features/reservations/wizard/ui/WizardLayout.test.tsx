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

  it('shows compact restaurant context when a name is provided @smoke', () => {
    // Given / When
    render(
      <WizardLayout restaurantName="The Old Crown">
        <p>body</p>
      </WizardLayout>,
    );

    // Then
    const heading = screen.getByRole('heading', { level: 1, name: 'The Old Crown' });
    const header = heading.closest('header');

    expect(header).not.toHaveClass('pg-panel');
    expect(header).not.toHaveClass('shadow-[var(--pg-shadow-edge)]');
    expect(screen.queryByText('Live availability')).not.toBeInTheDocument();
    expect(screen.queryByText('Instant confirmation')).not.toBeInTheDocument();
  });

  it('uses one guest gutter and a bounded readable content width @contract', () => {
    // Given / When
    render(
      <WizardLayout>
        <p>wizard body</p>
      </WizardLayout>,
    );

    // Then
    const main = screen.getByRole('main');
    const content = main.firstElementChild;

    expect(main).not.toHaveClass('px-[var(--pg-gutter)]');
    expect(content).toHaveClass('px-[var(--pg-gutter)]');
    expect(content).toHaveClass('max-w-3xl');
  });

  it('keeps ops spacing dense without applying the guest content bound @contract', () => {
    // Given / When
    const { container } = render(
      <WizardLayout elementType="div" surface="ops">
        <p>ops body</p>
      </WizardLayout>,
    );

    // Then
    const content = container.firstElementChild?.firstElementChild;

    expect(content).toHaveClass('p-3', 'sm:p-4', 'lg:p-5');
    expect(content).not.toHaveClass('max-w-3xl');
    expect(content).not.toHaveClass('px-[var(--pg-gutter)]');
  });

  it('renders progress in normal flow before step content @contract', () => {
    // Given / When
    render(
      <WizardLayout progress={<p>Step 1 of 4</p>}>
        <p>step content</p>
      </WizardLayout>,
    );

    // Then
    const progress = screen.getByText('Step 1 of 4');
    const stepContent = screen.getByText('step content');

    expect(progress.parentElement).toHaveAttribute('data-booking-wizard-progress-slot');
    expect(progress.compareDocumentPosition(stepContent) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
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
    // Given / When
    render(
      <WizardLayout stickyVisible stickyHeight={72}>
        <p>body</p>
      </WizardLayout>,
    );

    // Then
    const main = screen.getByRole('main');
    const content = main.firstElementChild;

    expect(main.style.paddingBottom).toContain('72px');
    expect(main.style.paddingBottom).toContain('safe-area-inset-bottom');
    expect(main.style.scrollPaddingBottom).toContain('72px');
    expect(main.style.scrollPaddingBottom).toContain('safe-area-inset-bottom');
    expect(content?.getAttribute('style')).toContain('72px');
    expect(content?.getAttribute('style')).toContain('safe-area-inset-bottom');
  });
});
