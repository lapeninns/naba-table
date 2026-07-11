import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { GbpConnectionSection } from '@/components/features/restaurant-settings/google-business-profile/sections/GbpConnectionSection';

describe('GbpConnectionSection', () => {
  it('@contract wraps the connect card and routes the connect action', async () => {
    const user = userEvent.setup();
    const onConnect = vi.fn();
    render(
      <GbpConnectionSection
        isConfigured
        isConnecting={false}
        isPendingAuth={false}
        lastError={null}
        onConnect={onConnect}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Connect/i }));

    expect(onConnect).toHaveBeenCalledTimes(1);
  });
});
