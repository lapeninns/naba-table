import { expect, fn, userEvent, within } from '@storybook/test';

import { buildTimeSlots } from '@reserve/features/reservations/wizard/services';
import { reservationConfigResult } from '@reserve/shared/config/reservations';

import { TimeSlotGrid } from './components/TimeSlotGrid';

import type { Meta, StoryObj } from '@storybook/react';

const baseSlots = buildTimeSlots({ date: '2025-05-08' });
const tooltip = reservationConfigResult.config.copy.unavailableTooltip;

const meta = {
  title: 'Reserve/Wizard/PlanStep/TimeSlotGrid',
  component: TimeSlotGrid,
  parameters: { layout: 'centered' },
  args: {
    slots: baseSlots,
    selected: '',
    tooltip,
    onSelect: fn(),
  },
} satisfies Meta<typeof TimeSlotGrid>;

export default meta;

type Story = StoryObj<typeof TimeSlotGrid>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const firstButton = await canvas.findByRole('button', { name: /12:00/i });
    await userEvent.click(firstButton);
    expect(args.onSelect).toHaveBeenCalled();
  },
};
