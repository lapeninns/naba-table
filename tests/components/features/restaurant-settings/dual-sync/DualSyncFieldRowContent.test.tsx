import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DualSyncFieldRowContent } from '@/components/features/restaurant-settings/dual-sync/DualSyncFieldRowContent';

import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

const field = {
  fieldKey: 'profile.name',
  coreValue: 'Old Crown Girton',
  gbpValue: 'Old Crown',
} as unknown as DualSyncFieldSummary;

describe('DualSyncFieldRowContent', () => {
  it('@contract previews both sides and routes action changes', async () => {
    const user = userEvent.setup();
    const onChangeAction = vi.fn();
    render(
      <DualSyncFieldRowContent
        actionAvailability={{ isUnsupported: false, canImport: true, canExport: true }}
        disabled={false}
        field={field}
        onChangeAction={onChangeAction}
        selectedAction={null}
      />,
    );

    expect(screen.getByText('Old Crown Girton')).toBeInTheDocument();
    expect(screen.getByText('Old Crown')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Send to Google' }));
    expect(onChangeAction).toHaveBeenCalledWith('export_to_google');
  });

  it('@contract explains unsupported fields instead of offering actions', () => {
    render(
      <DualSyncFieldRowContent
        actionAvailability={{ isUnsupported: true, canImport: false, canExport: false }}
        disabled={false}
        field={field}
        onChangeAction={vi.fn()}
        selectedAction={null}
      />,
    );

    expect(screen.getByText(/This field is Nabatable-only/)).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });
});
