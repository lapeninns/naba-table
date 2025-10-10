import { expect, fn, userEvent, within } from '@storybook/test';

import { OccasionPicker } from './components/OccasionPicker';

import type { ServiceAvailability } from '@reserve/features/reservations/wizard/services';
import type { BookingOption } from '@reserve/shared/booking';
import type { Meta, StoryObj } from '@storybook/react';

const availability: ServiceAvailability = {
  services: {
    lunch: 'disabled',
    dinner: 'disabled',
    drinks: 'enabled',
  },
  labels: {
    happyHour: true,
    drinksOnly: true,
    kitchenClosed: true,
    lunchWindow: false,
    dinnerWindow: false,
  },
};
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
