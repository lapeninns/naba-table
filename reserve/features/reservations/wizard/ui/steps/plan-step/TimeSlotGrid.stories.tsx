import { expect, fn, userEvent, within } from '@storybook/test';
import React, { useMemo, useState } from 'react';

import { Calendar24Field } from './components/Calendar24Field';

import type { Calendar24FieldProps } from './components/Calendar24Field';
import type { TimeSlotDescriptor } from '@reserve/features/reservations/wizard/services';
import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'Reserve/Wizard/PlanStep/Calendar24Field',
  component: Calendar24Field,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Calendar24Field>;

export default meta;

type Story = StoryObj<typeof Calendar24Field>;

const slots: TimeSlotDescriptor[] = [
  {
    value: '12:00',
    display: '12:00',
    label: 'Lunch',
    bookingOption: 'lunch',
    defaultBookingOption: 'lunch',
    availability: {
      services: { lunch: 'enabled', dinner: 'disabled', drinks: 'enabled' },
      labels: {
        happyHour: false,
        drinksOnly: false,
        kitchenClosed: false,
        lunchWindow: true,
        dinnerWindow: false,
      },
    },
    disabled: false,
    periodId: 'slot-lunch',
  },
  {
    value: '17:30',
    display: '17:30',
    label: 'Dinner',
    bookingOption: 'dinner',
    defaultBookingOption: 'dinner',
    availability: {
      services: { lunch: 'disabled', dinner: 'enabled', drinks: 'enabled' },
      labels: {
        happyHour: false,
        drinksOnly: false,
        kitchenClosed: false,
        lunchWindow: false,
        dinnerWindow: true,
      },
    },
    disabled: false,
    periodId: 'slot-dinner',
  },
  {
    value: '21:00',
    display: '21:00',
    label: 'Drinks & cocktails',
    bookingOption: 'drinks',
    defaultBookingOption: 'drinks',
    availability: {
      services: { lunch: 'disabled', dinner: 'disabled', drinks: 'enabled' },
      labels: {
        happyHour: true,
        drinksOnly: true,
        kitchenClosed: true,
        lunchWindow: false,
        dinnerWindow: false,
      },
    },
    disabled: false,
    periodId: 'slot-drinks',
  },
];

const DEFAULT_MIN_DATE = new Date('2025-05-01');

function StatefulCalendar24Field({ date, time, suggestions }: Calendar24FieldProps) {
  const [dateValue, setDateValue] = useState(date.value);
  const [timeValue, setTimeValue] = useState(time.value);
  const minDate = useMemo(() => date.minDate ?? DEFAULT_MIN_DATE, [date.minDate]);

  return (
    <Calendar24Field
      date={{
        ...date,
        value: dateValue,
        minDate,
        onSelect: (next) => {
          date.onSelect(next);
          if (next) {
            const iso = next.toISOString().slice(0, 10);
            setDateValue(iso);
          }
        },
      }}
      time={{
        ...time,
        value: timeValue,
        onChange: (value) => {
          time.onChange(value);
          setTimeValue(value);
        },
      }}
      suggestions={suggestions}
    />
  );
}

export const Default: Story = {
  args: {
    date: {
      value: '2025-05-08',
      minDate: DEFAULT_MIN_DATE,
      onSelect: fn(),
    },
    time: {
      value: '13:00',
      onChange: fn(),
    },
    suggestions: slots,
  },
  render: (args) => <StatefulCalendar24Field {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const timeInput = await canvas.findByLabelText(/time/i);
    await userEvent.clear(timeInput);
    await userEvent.type(timeInput, '14:30');
    expect(args.time.onChange).toHaveBeenCalled();
  },
};
