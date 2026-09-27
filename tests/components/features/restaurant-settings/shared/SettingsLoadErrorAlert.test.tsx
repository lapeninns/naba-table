import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SettingsLoadErrorAlert } from '@/components/features/restaurant-settings/shared/SettingsLoadErrorAlert';
import { HttpError } from '@/lib/http/errors';

// Stands in for server text that may echo guest data; it must never reach the DOM.
const RAW_SERVER_TEXT = 'Lookup failed for jane@example.com';

describe('SettingsLoadErrorAlert', () => {
  it('@contract shows the title, unchanged copy and a safe reason code only', () => {
    render(
      <SettingsLoadErrorAlert
        title="Couldn’t load staff communications"
        error={new Error(RAW_SERVER_TEXT)}
        onRetry={vi.fn()}
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Couldn’t load staff communications');
    expect(alert).toHaveTextContent('Your saved settings are unchanged. Reason code');
    expect(alert).not.toHaveTextContent(RAW_SERVER_TEXT);
    expect(alert.querySelector('.font-mono')).not.toBeNull();
  });

  it('@contract uses the HTTP error code as the reason code', () => {
    render(
      <SettingsLoadErrorAlert
        title="Couldn’t load tables"
        error={new HttpError({ message: RAW_SERVER_TEXT, status: 500, code: 'TABLES_UNAVAILABLE' })}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Reason code TABLES_UNAVAILABLE');
    expect(screen.getByRole('alert')).not.toHaveTextContent(RAW_SERVER_TEXT);
  });

  it('@contract offers a neutral outline retry that is not tinted destructive', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<SettingsLoadErrorAlert title="Couldn’t load menu" error={null} onRetry={onRetry} />);

    const retry = screen.getByRole('button', { name: 'Try again' });
    expect(retry).toHaveClass('text-foreground', 'border', 'bg-background');
    expect(retry.querySelector('svg')).toBeNull();
    await user.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('@contract disables the retry while retrying', () => {
    render(
      <SettingsLoadErrorAlert title="Couldn’t load menu" error={null} onRetry={vi.fn()} retrying />,
    );

    const retry = screen.getByRole('button', { name: 'Try again' });
    expect(retry).toBeDisabled();
    expect(retry).toHaveAttribute('aria-busy', 'true');
  });
});
