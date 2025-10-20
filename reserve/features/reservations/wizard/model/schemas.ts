import { z } from 'zod';

import { isEmail, isUKPhone } from '@reserve/shared/validation';

import type { BookingWizardMode } from './reducer';
import type { BookingOption } from '@reserve/shared/booking';

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
  bookingType: z.string().min(1, { message: 'Please select an occasion.' }),
  notes: z.string().max(500, { message: 'Notes must be 500 characters or fewer.' }).optional(),
});

export type PlanFormValues = z.infer<typeof planFormSchema>;

const nameSchema = z
  .string()
  .min(2, { message: 'Please enter at least two characters.' })
  .max(120, { message: 'Name looks too long. Shorten it a little.' });

const buildEmailSchema = (mode: BookingWizardMode) =>
  z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      if (!value) {
        if (mode !== 'ops') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Please enter a valid email address.',
          });
        }
        return;
      }

      if (!isEmail(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Please enter a valid email address.',
        });
      }
    });

const buildPhoneSchema = (mode: BookingWizardMode) =>
  z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      if (!value) {
        if (mode !== 'ops') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Please enter your phone number.',
          });
        }
        return;
      }

      if (!isUKPhone(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Please enter a valid UK mobile number (e.g. 07123 456789).',
        });
      }
    });

export const createDetailsFormSchema = (mode: BookingWizardMode = 'customer') =>
  z.object({
    name: nameSchema,
    email: buildEmailSchema(mode),
    phone: buildPhoneSchema(mode),
    rememberDetails: z.boolean().default(true),
    marketingOptIn: z.boolean().default(true),
    agree: z.boolean().refine((value) => value, {
      message: 'Please accept the terms to continue.',
    }),
  });

export const detailsFormSchema = createDetailsFormSchema('customer');

export type DetailsFormInputValues = z.input<typeof detailsFormSchema>;
export type DetailsFormValues = z.output<typeof detailsFormSchema>;

export type BookingOptionSchema = BookingOption;
