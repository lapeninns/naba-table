import { fn } from '@storybook/test';

import { WizardNavigation } from '../WizardNavigation';

import type { StepAction } from '../../model/reducer';
import type { WizardSummary, WizardStepMeta } from '../WizardProgress';
import type { Meta, StoryObj } from '@storybook/react';

const steps: WizardStepMeta[] = [
  { id: 1, label: 'Plan', helper: 'Date & time' },
  { id: 2, label: 'Details', helper: 'Contact info' },
  { id: 3, label: 'Review', helper: 'Confirm' },
  { id: 4, label: 'Done', helper: 'Status' },
];

const summary: WizardSummary = {
  primary: 'Tuesday, Mar 15',
  details: ['7:00 PM', '2 guests', 'Inside seating'],
  srLabel: 'Dinner on March 15 at 7 PM for two guests. Inside seating',
};

const actions: StepAction[] = [
  {
    id: 'back',
    label: 'Back',
    variant: 'outline',
    onClick: fn(),
    role: 'secondary',
  },
  {
    id: 'continue',
    label: 'Continue',
    variant: 'default',
    onClick: fn(),
    role: 'primary',
  },
];

const meta = {
  title: 'Reserve/Wizard/WizardNavigation',
  component: WizardNavigation,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    steps,
    summary,
    actions,
    currentStep: 2,
    visible: true,
  },
  argTypes: {
    onHeightChange: { action: 'heightChange' },
  },
} satisfies Meta<typeof WizardNavigation>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Confirmation: Story = {
  args: {
    currentStep: 4,
    actions: [
      {
        id: 'close',
        label: 'Close',
        icon: 'X',
        variant: 'ghost',
        onClick: fn(),
        role: 'secondary',
      },
      {
        id: 'calendar',
        label: 'Add to calendar',
        icon: 'Calendar',
        variant: 'outline',
        onClick: fn(),
        role: 'support',
      },
      {
        id: 'wallet',
        label: 'Add to wallet',
        icon: 'Wallet',
        variant: 'outline',
        onClick: fn(),
        role: 'support',
      },
      {
        id: 'new',
        label: 'New reservation',
        icon: 'Plus',
        variant: 'default',
        onClick: fn(),
        role: 'primary',
      },
    ],
    summary: {
      primary: '✓ Confirmed: Tue, Mar 15 at 7:00 PM',
      details: ['Reference Q8H42', '2 guests'],
      srLabel: 'Booking confirmed for March 15 at 7 PM, two guests, reference Q8H42',
    },
  },
};
