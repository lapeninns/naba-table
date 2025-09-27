import { WizardFooter } from '../WizardFooter';

import type { StepAction } from '../../model/reducer';

const actions: StepAction[] = [
  {
    id: 'back',
    label: 'Back',
    icon: 'ChevronLeft',
    variant: 'outline',
    onClick: () => console.log('Back'),
  },
  {
    id: 'continue',
    label: 'Continue',
    icon: 'Check',
    variant: 'default',
    onClick: () => console.log('Continue'),
  },
];

const meta = {
  title: 'Reservation/WizardFooter',
  component: WizardFooter,
  parameters: {
    layout: 'centered',
  },
  args: {
    steps: [
      { id: 1, label: 'Plan', helper: 'Pick date & time' },
      { id: 2, label: 'Details', helper: 'Contact info' },
      { id: 3, label: 'Review', helper: 'Confirm' },
    ],
    currentStep: 2,
    summary: {
      primary: 'Dinner reservation',
      details: ['2 guests', '19:00', 'Sat 12 Jul'],
      srLabel: 'Dinner reservation. 2 guests, 19:00, Sat 12 Jul',
    },
    actions,
    visible: true,
  },
};

export default meta;

export const Default = {};
export const LoadingPrimary = {
  args: {
    actions: [
      actions[0],
      {
        ...actions[1],
        loading: true,
        label: 'Saving…',
      },
    ],
  },
};
