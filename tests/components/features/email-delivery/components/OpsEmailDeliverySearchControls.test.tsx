import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OpsEmailDeliverySearchControls } from '@/components/features/email-delivery/components/OpsEmailDeliverySearchControls';

import type { OpsEmailDeliverySearchControlsProps } from '@/components/features/email-delivery/components/OpsEmailDeliverySearchControls';

function renderControls(overrides: Partial<OpsEmailDeliverySearchControlsProps> = {}) {
  const props: OpsEmailDeliverySearchControlsProps = {
    onSearchFieldChange: vi.fn(),
    onSearchValueChange: vi.fn(),
    onSubmitSearch: vi.fn(),
    searchField: 'recipientEmail',
    searchValue: '',
    ...overrides,
  };
  return { ...render(<OpsEmailDeliverySearchControls {...props} />), props };
}

describe('OpsEmailDeliverySearchControls', () => {
  it('@contract @a11y renders the field selector, labeled search input, and search button', () => {
    renderControls();

    expect(screen.getByRole('combobox', { name: 'Search field' })).toBeInTheDocument();
    expect(
      screen.getByRole('searchbox', { name: 'Search email delivery attempts' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
  });

  it('@contract switches the placeholder to match the selected search field', () => {
    renderControls({ searchField: 'bookingRef' });

    expect(screen.getByPlaceholderText('ABC123')).toBeInTheDocument();
  });

  it('@contract propagates typed input through onSearchValueChange', async () => {
    const user = userEvent.setup();
    const { props } = renderControls();

    await user.type(
      screen.getByRole('searchbox', { name: 'Search email delivery attempts' }),
      'a',
    );

    expect(props.onSearchValueChange).toHaveBeenCalledWith('a');
  });

  it('@contract submits on Enter inside the input and on the Search button', async () => {
    const user = userEvent.setup();
    const { props } = renderControls({ searchValue: 'guest@example.com' });

    await user.click(screen.getByRole('searchbox', { name: 'Search email delivery attempts' }));
    await user.keyboard('{Enter}');
    expect(props.onSubmitSearch).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(props.onSubmitSearch).toHaveBeenCalledTimes(2);
  });

  it('@contract changes the search field via the dropdown options', async () => {
    const user = userEvent.setup();
    const { props } = renderControls();

    await user.click(screen.getByRole('combobox', { name: 'Search field' }));
    await user.click(await screen.findByRole('option', { name: 'Message ID' }));

    expect(props.onSearchFieldChange).toHaveBeenCalledWith('messageId');
  });
});
