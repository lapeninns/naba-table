import { expect, fn, userEvent, within } from '@storybook/test';
import { useState } from 'react';

import { Calendar24Field } from './components/Calendar24Field';

import type { TimeSlotDescriptor } from '@reserve/features/reservations/wizard/services';
import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';

type CalendarStoryArgs = ComponentProps<typeof Calendar24Field>;

const slots: TimeSlotDescriptor[] = [
  {
    value: '12:00',
    display: '12:00',
    label: 'Lunch',
    bookingOption: 'lunch',
    defaultBookingOption: 'lunch',
    availability: {
      services: { lunch: 'enabled', dinner: 'disabled' },
      labels: { kitchenClosed: false, lunchWindow: true, dinnerWindow: false },
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
      services: { lunch: 'disabled', dinner: 'enabled' },
      labels: { kitchenClosed: false, lunchWindow: false, dinnerWindow: true },
    },
    disabled: false,
    periodId: 'slot-dinner',
  },
];

function CalendarStory({ date, time, ...props }: CalendarStoryArgs) {
  const [dateValue, setDateValue] = useState(date.value);
  const [timeValue, setTimeValue] = useState(time.value);

  return (
    <Calendar24Field
      {...props}
      date={{
        ...date,
        value: dateValue,
        onSelect: (next) => {
          date.onSelect(next);
          if (next) setDateValue(next.toISOString().slice(0, 10));
        },
      }}
      time={{
        ...time,
        value: timeValue,
        onChange: (next, options) => {
          setTimeValue(next);
          time.onChange(next, options);
        },
      }}
    />
  );
}

const meta = {
  title: 'Reserve/Wizard/PlanStep/Calendar24Field',
  component: Calendar24Field,
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <main className="guest-theme min-h-screen bg-background px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-3xl">
        <CalendarStory {...args} />
      </div>
    </main>
  ),
  args: {
    date: {
      value: '2026-07-18',
      minDate: new Date('2026-07-12T00:00:00'),
      onSelect: fn(),
    },
    time: { value: '12:00', onChange: fn() },
    suggestions: slots,
    intervalMinutes: 30,
    onMonthChange: fn(),
  },
} satisfies Meta<CalendarStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(await canvas.findByRole('combobox', { name: 'Time' }));
    await userEvent.click(await page.findByRole('option', { name: '17:30' }));
    expect(args.time.onChange).toHaveBeenCalledWith('17:30', { commit: true });
  },
};
