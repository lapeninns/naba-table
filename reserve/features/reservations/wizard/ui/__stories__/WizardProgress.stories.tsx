import { WizardProgress } from '../WizardProgress';

const meta = {
  title: 'Reservation/WizardProgress',
  component: WizardProgress,
  parameters: {
    layout: 'centered',
  },
  args: {
    steps: [
      { id: 1, label: 'Plan', helper: 'Pick date & time' },
      { id: 2, label: 'Details', helper: 'Contact info' },
      { id: 3, label: 'Review', helper: 'Confirm details' },
      { id: 4, label: 'Confirmation', helper: 'Status' },
    ],
    currentStep: 2,
    summary: {
      primary: 'Dinner reservation',
      details: ['2 guests', '19:00', 'Sat 12 Jul'],
      srLabel: 'Dinner reservation. 2 guests, 19:00, Sat 12 Jul',
    },
  },
};

export default meta;

export const Default = {};
export const FinalStep = {
  args: {
    currentStep: 4,
    summary: {
      primary: 'Booking confirmed',
      details: ['4 guests', '20:30', 'Fri 20 Sep'],
      srLabel: 'Booking confirmed. 4 guests, 20:30, Fri 20 Sep',
    },
  },
};
