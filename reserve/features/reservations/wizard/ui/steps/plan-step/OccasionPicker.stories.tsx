import { expect, fn, userEvent, within } from '@storybook/test';

import { OccasionPicker } from './components/OccasionPicker';

import type { OccasionPickerOption } from './components/OccasionPicker';
import type { ServiceAvailability } from '@reserve/features/reservations/wizard/services';
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
const OPTIONS: OccasionPickerOption[] = [
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'drinks', label: 'Drinks' },
];

const meta = {
  title: 'Reserve/Wizard/PlanStep/OccasionPicker',
  component: OccasionPicker,
  parameters: { layout: 'centered' },
  args: {
    value: 'dinner',
    options: OPTIONS,
    availability,
    availableOptions: OPTIONS.map((option) => option.key),
    onChange: fn(),
  },
} satisfies Meta<typeof OccasionPicker>;

export default meta;

type Story = StoryObj<typeof OccasionPicker>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const drinksToggle = await canvas.findByRole('button', { name: /Drinks/i });
    await userEvent.click(drinksToggle);
    expect(args.onChange).toHaveBeenCalled();
  },
};
