import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  AvailabilitySaveAlert,
  AvailabilityScheduleFooter,
  AvailabilityScheduleHeader,
  RequiredBookingTypesAlert,
} from '@/components/features/restaurant-settings/AvailabilityScheduleManagerChrome';

describe('AvailabilityScheduleHeader', () => {
  it('@smoke renders schedule workspace copy with the unsaved badge', () => {
    render(<AvailabilityScheduleHeader hasLocalChanges isScheduleWorkspace />);

    expect(screen.getByText('Weekly schedule')).toBeInTheDocument();
    expect(screen.getByText('Operating hours and service windows together')).toBeInTheDocument();
    expect(screen.getByText('Unsaved changes in this section')).toBeInTheDocument();
  });

  it('@smoke renders booking-types copy without the unsaved badge', () => {
    render(<AvailabilityScheduleHeader hasLocalChanges={false} isScheduleWorkspace={false} />);

    expect(screen.getByText('Booking types and turn times')).toBeInTheDocument();
    expect(screen.queryByText('Unsaved changes in this section')).not.toBeInTheDocument();
  });
});

describe('AvailabilitySaveAlert', () => {
  it('@contract renders nothing without a save state', () => {
    const { container } = render(<AvailabilitySaveAlert saveState={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('@contract lists save details for a destructive result', () => {
    render(
      <AvailabilitySaveAlert
        saveState={{
          variant: 'destructive',
          title: 'Save failed',
          message: 'Some sections could not be saved.',
          details: ['Operating hours failed', 'Service windows failed'],
        }}
      />,
    );

    expect(screen.getByText('Save failed')).toBeInTheDocument();
    expect(screen.getByText('Operating hours failed')).toBeInTheDocument();
    expect(screen.getByText('Service windows failed')).toBeInTheDocument();
  });
});

describe('RequiredBookingTypesAlert', () => {
  it('@contract triggers creation of the required occasions and disables while saving', async () => {
    const user = userEvent.setup();
    const onCreateRequiredOccasions = vi.fn();
    const { rerender } = render(
      <RequiredBookingTypesAlert
        isSaving={false}
        onCreateRequiredOccasions={onCreateRequiredOccasions}
      />,
    );

    const button = screen.getByRole('button', {
      name: 'Create missing lunch and dinner booking types',
    });
    await user.click(button);
    expect(onCreateRequiredOccasions).toHaveBeenCalledTimes(1);

    rerender(
      <RequiredBookingTypesAlert isSaving onCreateRequiredOccasions={onCreateRequiredOccasions} />,
    );
    expect(button).toBeDisabled();
  });
});

describe('AvailabilityScheduleFooter', () => {
  function renderFooter(overrides: Partial<Parameters<typeof AvailabilityScheduleFooter>[0]> = {}) {
    const handlers = { onReset: vi.fn(), onSave: vi.fn() };
    render(
      <AvailabilityScheduleFooter
        canSave
        hasLocalChanges
        isSaving={false}
        saveState={null}
        {...handlers}
        {...overrides}
      />,
    );
    return handlers;
  }

  it('@contract fires save and reset callbacks', async () => {
    const user = userEvent.setup();
    const { onReset, onSave } = renderFooter();

    await user.click(screen.getByRole('button', { name: /Save configuration/ }));
    expect(onSave).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /Reset/ }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('@contract disables actions while saving or without changes', () => {
    renderFooter({ canSave: false, hasLocalChanges: false, isSaving: true });

    expect(screen.getByRole('button', { name: /Save configuration/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Reset/ })).toBeDisabled();
  });

  it('@smoke summarises save details count when present', () => {
    renderFooter({
      saveState: {
        variant: 'success',
        title: 'Saved',
        message: 'All good.',
        details: ['Operating hours saved'],
      },
    });

    expect(screen.getByText('1 save result detail shown above.')).toBeInTheDocument();
  });
});
