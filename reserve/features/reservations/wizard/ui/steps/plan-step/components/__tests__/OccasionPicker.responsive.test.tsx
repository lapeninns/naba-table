import { render, screen } from '@testing-library/react';
import React from 'react';
import { useForm } from 'react-hook-form';

import { Form, FormField } from '@/components/ui/form';

import { OccasionPicker } from '../OccasionPicker';

import type { OccasionPickerOption } from '../OccasionPicker';
import type { BookingOption } from '@reserve/shared/booking';

function WrappedOccasionPicker({ availableOptions }: { availableOptions: BookingOption[] }) {
  const form = useForm<{ bookingType: BookingOption }>({
    defaultValues: { bookingType: 'lunch' },
  });

  const options: OccasionPickerOption[] = [
    { key: 'lunch', label: 'Lunch' },
    { key: 'dinner', label: 'Dinner' },
    { key: 'drinks', label: 'Drinks & Cocktails' },
  ];

  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="bookingType"
        render={({ field }) => (
          <OccasionPicker
            value={field.value}
            options={options}
            availability={{
              services: { lunch: 'enabled', dinner: 'enabled', drinks: 'enabled' },
              labels: {
                happyHour: false,
                drinksOnly: false,
                kitchenClosed: false,
                lunchWindow: true,
                dinnerWindow: true,
              },
            }}
            availableOptions={availableOptions}
            onChange={field.onChange}
          />
        )}
      />
    </Form>
  );
}

describe('OccasionPicker responsive layout', () => {
  it('uses responsive grid classes and 44px targets', () => {
    render(<WrappedOccasionPicker availableOptions={['lunch', 'dinner', 'drinks']} />);

    // Group uses grid-cols-2 on base and sm:grid-cols-3 on small+. We assert presence of className.
    const group = screen.getByRole('group');
    expect(group.className).toMatch(/grid-cols-2/);
    expect(group.className).toMatch(/sm:grid-cols-3/);

    // Each item has h-11 (44px) height
    const item = screen.getByText('Lunch').closest('[data-state]');
    expect(item?.className).toMatch(/h-11/);
  });

  it('disables options that are not available for the selected date', () => {
    render(<WrappedOccasionPicker availableOptions={['dinner']} />);
    const lunchButton = screen.getByRole('radio', { name: 'Lunch' });
    const drinksButton = screen.getByRole('radio', { name: /Drinks & Cocktails/i });
    const dinnerButton = screen.getByRole('radio', { name: 'Dinner' });

    expect(lunchButton).toBeDisabled();
    expect(drinksButton).toBeDisabled();
    expect(dinnerButton).toBeEnabled();
  });
});
