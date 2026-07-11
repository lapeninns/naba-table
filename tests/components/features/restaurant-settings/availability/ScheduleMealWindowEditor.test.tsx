import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ScheduleMealWindowEditor } from '@/components/features/restaurant-settings/availability/ScheduleMealWindowEditor';

function renderEditor(overrides: Partial<Parameters<typeof ScheduleMealWindowEditor>[0]> = {}) {
  const handlers = { onChange: vi.fn(), onToggle: vi.fn() };
  render(
    <ScheduleMealWindowEditor
      disabled={false}
      idPrefix="day-1-lunch"
      label="Lunch"
      meal={{ enabled: true, startTime: '12:00', endTime: '15:00' }}
      {...handlers}
      {...overrides}
    />,
  );
  return handlers;
}

describe('ScheduleMealWindowEditor', () => {
  it('@smoke renders the meal label with start and end inputs', () => {
    renderEditor();

    expect(screen.getByText('Lunch')).toBeInTheDocument();
    expect(screen.getByLabelText('Start')).toHaveValue('12:00');
    expect(screen.getByLabelText('End')).toHaveValue('15:00');
  });

  it('@contract toggles the meal window', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderEditor();

    await user.click(screen.getByRole('switch', { name: 'Active' }));

    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it('@contract emits field changes for start and end times', () => {
    const { onChange } = renderEditor();

    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '11:30' } });
    expect(onChange).toHaveBeenCalledWith('startTime', '11:30');

    fireEvent.change(screen.getByLabelText('End'), { target: { value: '14:30' } });
    expect(onChange).toHaveBeenLastCalledWith('endTime', '14:30');
  });

  it('@contract disables time inputs when the meal is inactive or the editor is disabled', () => {
    renderEditor({ meal: { enabled: false, startTime: '', endTime: '' } });

    expect(screen.getByLabelText('Start')).toBeDisabled();
    expect(screen.getByLabelText('End')).toBeDisabled();
  });

  it('@contract @a11y marks invalid fields and shows their error copy', () => {
    renderEditor({ errors: { start: 'Start must be before end', end: 'End is outside hours' } });

    expect(screen.getByLabelText('Start')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Start must be before end')).toBeInTheDocument();
    expect(screen.getByText('End is outside hours')).toBeInTheDocument();
  });
});
