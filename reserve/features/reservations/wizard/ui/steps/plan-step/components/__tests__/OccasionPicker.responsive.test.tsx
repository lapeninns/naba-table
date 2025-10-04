import { render, screen } from '@testing-library/react';
import React from 'react';
import { useForm } from 'react-hook-form';

import { Form, FormField } from '@/components/ui/form';

import { OccasionPicker } from '../OccasionPicker';

function WrappedOccasionPicker() {
  const form = useForm<{ bookingType: 'lunch' | 'dinner' | 'drinks' }>({
    defaultValues: { bookingType: 'lunch' },
  });

  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="bookingType"
        render={({ field }) => (
          <OccasionPicker
            value={field.value}
            order={['lunch', 'dinner', 'drinks']}
            availability={{ services: { lunch: 'enabled', dinner: 'enabled', drinks: 'enabled' } }}
            onChange={field.onChange}
          />
        )}
      />
    </Form>
  );
}

describe('OccasionPicker responsive layout', () => {
  it('uses responsive grid classes and 44px targets', () => {
    render(<WrappedOccasionPicker />);

    // Group uses grid-cols-2 on base and sm:grid-cols-3 on small+. We assert presence of className.
    const group = screen.getByRole('group');
    expect(group.className).toMatch(/grid-cols-2/);
    expect(group.className).toMatch(/sm:grid-cols-3/);

    // Each item has h-11 (44px) height
    const item = screen.getByText('Lunch').closest('[data-state]');
    expect(item?.className).toMatch(/h-11/);
  });
});
