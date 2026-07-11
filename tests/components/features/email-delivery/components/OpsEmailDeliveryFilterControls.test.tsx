import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OpsEmailDeliveryFilterControls } from '@/components/features/email-delivery/components/OpsEmailDeliveryFilterControls';

import type { OpsEmailDeliveryFilterControlsProps } from '@/components/features/email-delivery/components/OpsEmailDeliveryFilterControls';

function renderControls(overrides: Partial<OpsEmailDeliveryFilterControlsProps> = {}) {
  const props: OpsEmailDeliveryFilterControlsProps = {
    emailType: null,
    onEmailTypeChange: vi.fn(),
    onRangeValueChange: vi.fn(),
    onTemplateTypeChange: vi.fn(),
    range: '7d',
    templateType: null,
    ...overrides,
  };
  return { ...render(<OpsEmailDeliveryFilterControls {...props} />), props };
}

describe('OpsEmailDeliveryFilterControls', () => {
  it('@contract @a11y renders the range toggle with 24h/7d/30d options and both filter selects', () => {
    renderControls();

    expect(screen.getByRole('radio', { name: 'Last 24 hours' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Last 7 days' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: 'Last 30 days' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Filter by template type' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Filter by email type' })).toBeInTheDocument();
  });

  it('@contract reports range selection through onRangeValueChange', async () => {
    const user = userEvent.setup();
    const { props } = renderControls();

    await user.click(screen.getByRole('radio', { name: 'Last 24 hours' }));

    expect(props.onRangeValueChange).toHaveBeenCalledWith('24h');
  });

  it('@contract maps a concrete template type selection and the All option back to null', async () => {
    const user = userEvent.setup();
    const { props } = renderControls({ templateType: 'review_request' });

    await user.click(screen.getByRole('combobox', { name: 'Filter by template type' }));
    await user.click(await screen.findByRole('option', { name: 'booking confirmation' }));
    expect(props.onTemplateTypeChange).toHaveBeenCalledWith('booking_confirmation');

    await user.click(screen.getByRole('combobox', { name: 'Filter by template type' }));
    await user.click(await screen.findByRole('option', { name: 'All templates' }));
    expect(props.onTemplateTypeChange).toHaveBeenCalledWith(null);
  });

  it('@contract maps a concrete email type selection and the All option back to null', async () => {
    const user = userEvent.setup();
    const { props } = renderControls({ emailType: 'reminder' });

    await user.click(screen.getByRole('combobox', { name: 'Filter by email type' }));
    await user.click(await screen.findByRole('option', { name: 'created' }));
    expect(props.onEmailTypeChange).toHaveBeenCalledWith('created');

    await user.click(screen.getByRole('combobox', { name: 'Filter by email type' }));
    await user.click(await screen.findByRole('option', { name: 'All types' }));
    expect(props.onEmailTypeChange).toHaveBeenCalledWith(null);
  });
});
