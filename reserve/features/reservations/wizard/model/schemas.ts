import { z } from 'zod';

import { bookingHelpers, type BookingOption } from '@reserve/shared/utils/booking';
import { BOOKING_TYPES_UI } from '@shared/config/booking';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const planFormSchema = z.object({
  date: z
    .string()
    .min(1, { message: 'Please select a date.' })
    .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00`).getTime()), {
      message: 'Please choose a valid date.',
    }),
  time: z
    .string()
    .min(1, { message: 'Please select a time.' })
    .regex(TIME_REGEX, { message: 'Please select a valid time.' }),
  party: z
    .number()
    .min(1, { message: 'Minimum of one guest required.' })
    .max(12, { message: 'We can accommodate up to 12 guests online.' }),
  bookingType: z.enum(BOOKING_TYPES_UI),
  notes: z.string().max(500, { message: 'Notes must be 500 characters or fewer.' }).optional(),
});

export type PlanFormValues = z.infer<typeof planFormSchema>;

export const detailsFormSchema = z.object({
  name: z
    .string()
    .min(2, { message: 'Please enter at least two characters.' })
    .max(120, { message: 'Name looks too long. Shorten it a little.' }),
  email: z
    .string()
    .email({ message: 'Please enter a valid email address.' })
    .refine((value) => bookingHelpers.isEmail(value), {
      message: 'Please enter a valid email address.',
    }),
  phone: z
    .string()
    .min(6, { message: 'Please enter your phone number.' })
    .refine((value) => bookingHelpers.isUKPhone(value), {
      message: 'Please enter a valid UK mobile number (e.g. 07123 456789).',
    }),
  rememberDetails: z.boolean().default(true),
  marketingOptIn: z.boolean().default(true),
  agree: z.boolean().refine((value) => value, {
    message: 'Please accept the terms to continue.',
  }),
});

export type DetailsFormInputValues = z.input<typeof detailsFormSchema>;
export type DetailsFormValues = z.output<typeof detailsFormSchema>;

export type BookingOptionSchema = BookingOption;
