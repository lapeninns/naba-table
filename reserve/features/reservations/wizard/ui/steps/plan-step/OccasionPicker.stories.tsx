import { expect, fn, userEvent, within } from '@storybook/test';

import { getServiceAvailability } from '@reserve/features/reservations/wizard/services';

import { OccasionPicker } from './components/OccasionPicker';

import type { BookingOption } from '@reserve/features/reservations/wizard/services';
import type { Meta, StoryObj } from '@storybook/react';

const availability = getServiceAvailability('2025-05-08', '16:00');
const ORDER: BookingOption[] = ['lunch', 'dinner', 'drinks'];

const meta = {
  title: 'Reserve/Wizard/PlanStep/OccasionPicker',
  component: OccasionPicker,
  parameters: { layout: 'centered' },
  args: {
    value: 'dinner',
    order: ORDER,
    availability,
    onChange: fn(),
  },
} satisfies Meta<typeof OccasionPicker>;

export default meta;

type Story = StoryObj<typeof OccasionPicker>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const drinksToggle = await canvas.findByRole('button', { name: /Drinks & cocktails/i });
    await userEvent.click(drinksToggle);
    expect(args.onChange).toHaveBeenCalled();
  },
};
