import { z } from 'zod';

import { MAX_ONLINE_PARTY_SIZE, ONLINE_PARTY_SIZE_LIMIT_COPY } from '@/lib/bookings/partySize';
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
    .max(MAX_ONLINE_PARTY_SIZE, { message: ONLINE_PARTY_SIZE_LIMIT_COPY }),
  bookingType: z.string().optional(),
  sundayRoast: z.boolean(),
  notes: z.string().max(500, { message: 'Notes must be 500 characters or fewer.' }).optional(),
});

export type PlanFormValues = z.infer<typeof planFormSchema>;

const nameSchema = z
  .string()
  .min(2, { message: 'Please enter at least two characters.' })
  .max(120, { message: 'Name looks too long. Shorten it a little.' });

const buildEmailSchema = () =>
  z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      if (!value) {
        return;
      }

      if (!isEmail(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Please enter a valid email address.',
        });
      }
    });

const buildPhoneSchema = () =>
  z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      if (!value) {
        return;
      }

      if (!isUKPhone(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Please enter a valid UK phone number (e.g. 020 7123 4567 or 07123 456789).',
        });
      }
    });

const buildAgreeSchema = (mode: BookingWizardMode) => {
  if (mode === 'ops') {
    return z.boolean().default(true);
  }

  return z.boolean().refine((value) => value, {
    message: 'Please accept the terms to continue.',
  });
};

export const createDetailsContactSchema = () =>
  z
    .object({
      name: nameSchema,
      email: buildEmailSchema(),
      phone: buildPhoneSchema(),
    })
    .superRefine((values, ctx) => {
      const hasEmail = values.email.trim().length > 0;
      const hasPhone = values.phone.trim().length > 0;

      if (hasEmail || hasPhone) {
        return;
      }

      const message = 'Add an email address or phone number.';
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['email'],
        message,
      });
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['phone'],
        message,
      });
    });

export const createDetailsFormSchema = (mode: BookingWizardMode = 'customer') =>
  createDetailsContactSchema().and(
    z.object({
      rememberDetails: z.boolean().default(mode !== 'ops'),
      // Ops bookings are staff-created on behalf of the guest: consent defaults on.
      marketingOptIn: z.boolean().default(true),
      whatsappOptIn: z.boolean().default(mode === 'ops'),
      agree: buildAgreeSchema(mode),
    }),
  );

export const detailsFormSchema = createDetailsFormSchema('customer');

export type DetailsFormInputValues = z.input<typeof detailsFormSchema>;
export type DetailsFormValues = z.output<typeof detailsFormSchema>;

export type BookingOptionSchema = BookingOption;
