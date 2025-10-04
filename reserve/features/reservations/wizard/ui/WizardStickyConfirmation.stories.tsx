import React from 'react';

import { WizardStickyConfirmation } from './WizardStickyConfirmation';

import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof WizardStickyConfirmation> = {
  title: 'Wizard/WizardStickyConfirmation',
  component: WizardStickyConfirmation,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof WizardStickyConfirmation>;

const steps = [
  { id: 1, label: 'Plan', helper: 'Pick date, time, and party' },
  { id: 2, label: 'Details', helper: 'Share contact information' },
  { id: 3, label: 'Review', helper: 'Double-check and confirm' },
  { id: 4, label: 'Confirmation', helper: 'Your reservation status' },
];

export const Example: Story = {
  render: () => (
    <div style={{ minHeight: '160vh', background: 'var(--color-app-bg, #f8fafc)' }}>
      <div style={{ padding: '16px' }}>
        <p>Scroll to view the sticky confirmation bar demo.</p>
      </div>
      <WizardStickyConfirmation
        steps={steps}
        currentStep={4}
        summary={{ primary: 'Lunch', details: ['1 guest', '12:00', 'Oct 04 2025'] }}
        onClose={() => console.log('close')}
        onAddToCalendar={() => console.log('calendar')}
        onAddToWallet={() => console.log('wallet')}
        onStartNew={() => console.log('new')}
      />
    </div>
  ),
};
