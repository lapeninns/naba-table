import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BusinessDetailsForm } from '@/components/features/restaurant-settings/discovery/panels/BusinessDetailsForm';

import { makeBusinessContextEditor } from '../../testUtils';

import type { RestaurantBusinessContextEditor } from '@/components/features/restaurant-settings/useRestaurantBusinessContextEditor';

function renderForm(editor = makeBusinessContextEditor()) {
  render(<BusinessDetailsForm editor={editor as unknown as RestaurantBusinessContextEditor} />);
  return editor;
}

describe('BusinessDetailsForm', () => {
  beforeEach(() => {
    // Opening-date picker defaults its calendar month to "now" when empty.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 6, 11, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('@smoke @a11y renders opening date, status select, and service-area toggle', () => {
    renderForm();

    expect(screen.getByText('Opening date')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Business status' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Service-area business' })).toBeInTheDocument();
  });

  it('@contract updates the business status through the select', async () => {
    const user = userEvent.setup();
    const editor = renderForm();

    await user.click(screen.getByRole('combobox', { name: 'Business status' }));
    await user.click(await screen.findByRole('option', { name: 'Closed temporarily' }));

    expect(editor.updateBusinessDetails).toHaveBeenCalledWith(
      'businessStatus',
      'closed_temporarily',
    );
  });

  it('@contract toggles the service-area business flag', async () => {
    const user = userEvent.setup();
    const editor = renderForm();

    await user.click(screen.getByRole('switch'));

    expect(editor.updateBusinessDetails).toHaveBeenCalledWith('isServiceAreaBusiness', true);
  });
});
