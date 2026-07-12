import { expect, fn, userEvent, waitFor, within } from '@storybook/test';
import { SparklesIcon } from 'lucide-react';
import { useArgs } from 'storybook/preview-api';

import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

import type { Meta, StoryObj } from '@storybook/react';

type OccasionSelectionDesignFixtureProps = {
  value: 'lunch' | 'dinner';
  onChange: (value: 'lunch' | 'dinner') => void;
};

function OccasionSelectionDesignFixture({ value, onChange }: OccasionSelectionDesignFixtureProps) {
  return (
    <section className="space-y-3">
      <Label className="flex items-center gap-1.5 text-sm font-semibold sm:text-base">
        <SparklesIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        <span>Occasion</span>
      </Label>
      <ToggleGroup
        type="single"
        className="grid grid-cols-2 gap-2.5"
        value={value}
        onValueChange={(next) => {
          if (next === 'lunch' || next === 'dinner') {
            onChange(next);
          }
        }}
      >
        <ToggleGroupItem value="lunch" className="pg-action h-12 text-sm font-medium">
          Lunch
        </ToggleGroupItem>
        <ToggleGroupItem value="dinner" className="pg-action h-12 text-sm font-medium">
          Dinner
        </ToggleGroupItem>
      </ToggleGroup>
      <p className="text-xs text-muted-foreground sm:text-sm">
        Let us know the occasion so we can tailor your experience.
      </p>
    </section>
  );
}

const meta = {
  title: 'Reserve/Wizard/PlanStep/OccasionSelectionDesignFixture',
  component: OccasionSelectionDesignFixture,
  parameters: { layout: 'centered' },
  render: function Render(args) {
    const [, updateArgs] = useArgs<OccasionSelectionDesignFixtureProps>();
    return (
      <OccasionSelectionDesignFixture
        {...args}
        onChange={(next) => {
          updateArgs({ value: next });
          args.onChange(next);
        }}
      />
    );
  },
  args: {
    value: 'lunch',
    onChange: fn(),
  },
} satisfies Meta<OccasionSelectionDesignFixtureProps>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('radio', { name: 'Dinner' }));
    expect(args.onChange).toHaveBeenCalledWith('dinner');
    await waitFor(() =>
      expect(canvas.getByRole('radio', { name: 'Dinner' })).toHaveAttribute('data-state', 'on'),
    );
  },
};
