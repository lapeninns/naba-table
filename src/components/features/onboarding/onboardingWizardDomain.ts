import { z } from 'zod';

import type { OnboardingState, OnboardingStep } from './types';

export const ONBOARDING_STEPS = [
  { id: 1 as OnboardingStep, title: 'Account', description: 'Create your owner login' },
  { id: 2 as OnboardingStep, title: 'Profile', description: 'Restaurant basics' },
  { id: 3 as OnboardingStep, title: 'Hours', description: 'Weekly opening times' },
  { id: 4 as OnboardingStep, title: 'Services', description: 'Define service periods' },
  { id: 5 as OnboardingStep, title: 'Tables', description: 'Zones and tables' },
  { id: 6 as OnboardingStep, title: 'Review', description: 'Confirm & launch' },
];

export const STEP_PATHS: Record<OnboardingStep, string> = {
  1: '/onboarding',
  2: '/onboarding/profile',
  3: '/onboarding/hours',
  4: '/onboarding/services',
  5: '/onboarding/tables',
  6: '/onboarding/review',
};

export function stepFromPathname(pathname: string | null): OnboardingStep {
  switch (pathname) {
    case '/onboarding/profile':
      return 2;
    case '/onboarding/hours':
      return 3;
    case '/onboarding/services':
      return 4;
    case '/onboarding/tables':
      return 5;
    case '/onboarding/review':
      return 6;
    case '/onboarding':
    default:
      return 1;
  }
}

export function getMaxAccessibleStep(state: OnboardingState): OnboardingStep {
  if (!state.account) {
    return 1;
  }

  if (!state.restaurantId) {
    return 2;
  }

  return 6;
}

export const accountSchema = z
  .object({
    email: z.string().trim().min(1, 'Email is required').email('Enter a valid email'),
    mode: z.enum(['password', 'magic_link']),
    password: z.string().min(8, 'Use at least 8 characters').optional(),
  })
  .superRefine((values, ctx) => {
    if (values.mode === 'password' && !values.password) {
      ctx.addIssue({
        code: 'custom',
        path: ['password'],
        message: 'Password is required for password sign-up',
      });
    }
  });

export const profileSchema = z.object({
  name: z.string().trim().min(1, 'Restaurant name is required'),
  slug: z.string().trim().min(1, 'Slug is required'),
  timezone: z.string().trim().min(1, 'Timezone is required'),
  contactEmail: z.union([z.string().email(), z.literal('')]).optional(),
  contactPhone: z.string().optional(),
  bookingPolicy: z.string().optional(),
});

export const DEFAULT_BOOKING_OPTIONS = ['lunch', 'dinner'];

export const servicePeriodSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  dayOfWeek: z.number().int().min(0).max(6).nullable(),
  startTime: z.string().min(1, 'Start time required'),
  endTime: z.string().min(1, 'End time required'),
  bookingOption: z.string().min(1, 'Select a booking option'),
});

export const servicePeriodsFormSchema = z.object({
  servicePeriods: z.array(servicePeriodSchema),
});

export const tableSchema = z.object({
  tableNumber: z.string().trim().min(1, 'Table number required'),
  capacity: z.coerce.number().int().min(1, 'Capacity required'),
  zoneId: z.string().nullish(),
});

export const tablesFormSchema = z.object({
  tables: z.array(tableSchema),
});

export type TablesFormValues = z.input<typeof tablesFormSchema>;

export const timeInputPlaceholder = 'e.g. 17:00';
