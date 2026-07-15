import { z } from 'zod';

const guestTemplateKeys = [
  'bookingConfirmation',
  'bookingUpdate',
  'bookingCancellation',
  'restaurantCancellation',
  'reviewRequest',
] as const;

const templateKeys = [...guestTemplateKeys, 'managerDailySummary'] as const;

type TemplateKey = (typeof templateKeys)[number];

type SelectedContentSids = Readonly<Record<TemplateKey, string>>;

type TemplateReadback = {
  readonly key: string;
  readonly sid: string;
  readonly status: string;
  readonly category: string;
  readonly rejectionReason: string;
};

type ReadinessInput = {
  readonly sender: string;
  readonly selectedContentSids: SelectedContentSids;
  readonly recordedCategories: Readonly<Record<TemplateKey, string>>;
  readonly templates: readonly TemplateReadback[];
};

const reviewTemplateSchema = z.object({
  friendly_name: z.string(),
  language: z.string(),
  variables: z.record(z.string(), z.string()),
  types: z.object({
    'twilio/call-to-action': z.object({
      body: z.string(),
      actions: z
        .array(
          z.object({
            type: z.string(),
            title: z.string(),
            url: z.string(),
          }),
        )
        .length(1),
    }),
  }),
});

const guestTemplateRequestSchema = z
  .object({
    friendly_name: z.string(),
    language: z.string(),
    variables: z.record(z.string(), z.string()),
    types: z.union([
      z
        .object({
          'twilio/call-to-action': z
            .object({
              body: z.string(),
              actions: z.array(
                z.object({
                  type: z.string(),
                  title: z.string(),
                  url: z.string(),
                }),
              ),
            })
            .strict(),
        })
        .strict(),
      z
        .object({
          'twilio/text': z.object({ body: z.string() }).strict(),
        })
        .strict(),
    ]),
  })
  .strict();

const guestTemplateRequestsSchema = z
  .object({
    bookingConfirmation: guestTemplateRequestSchema,
    bookingUpdate: guestTemplateRequestSchema,
    bookingCancellation: guestTemplateRequestSchema,
    restaurantCancellation: guestTemplateRequestSchema,
    reviewRequest: guestTemplateRequestSchema,
  })
  .strict();

const whatsappTemplateRequestsSchema = z
  .object({
    bookingConfirmation: guestTemplateRequestSchema,
    bookingUpdate: guestTemplateRequestSchema,
    bookingCancellation: guestTemplateRequestSchema,
    restaurantCancellation: guestTemplateRequestSchema,
    reviewRequest: guestTemplateRequestSchema,
    managerDailySummary: guestTemplateRequestSchema,
  })
  .strict();

const reviewBody =
  'Thanks for visiting {{1}}.\n\nWe hope you enjoyed your visit. Your feedback helps our team and future guests.\n\nTap below to leave a quick review.\n\nThank you for supporting us.';

export const GUEST_TEMPLATE_REQUESTS = {
  bookingConfirmation: {
    friendly_name: 'nabatable_booking_confirmation_20260714_v3',
    language: 'en',
    variables: {
      '1': 'The Old Crown Girton',
      '2': 'Sat, 18 Jul 2026 at 19:00 | 4 guests',
      '3': 'Reference: NBT-1234',
      '4': 'https://go.nabatable.com/m/secure-token',
      '5': 'm/secure-token',
    },
    types: {
      'twilio/call-to-action': {
        body: 'Booking confirmed at {{1}}\n\n{{2}}\n{{3}}\n\nUse the button below to manage or cancel your booking.\nIf the button is unavailable, use this secure link: {{4}}\n\nWe look forward to seeing you.',
        actions: [
          {
            type: 'URL',
            title: 'Manage booking',
            url: 'https://go.nabatable.com/{{5}}',
          },
        ],
      },
    },
  },
  bookingUpdate: {
    friendly_name: 'nabatable_booking_update_20260714_v3',
    language: 'en',
    variables: {
      '1': 'The Old Crown Girton',
      '2': 'Sat, 18 Jul 2026 at 19:30 | 4 guests',
      '3': 'Reference: NBT-1234',
      '4': 'https://go.nabatable.com/m/update-token',
      '5': 'm/update-token',
    },
    types: {
      'twilio/call-to-action': {
        body: 'Your booking at {{1}} has been updated.\n\n{{2}}\n{{3}}\n\nUse the button below to review or manage the latest details.\nIf the button is unavailable, use this secure link: {{4}}\n\nPlease check everything looks right before your visit.',
        actions: [
          {
            type: 'URL',
            title: 'Review booking',
            url: 'https://go.nabatable.com/{{5}}',
          },
        ],
      },
    },
  },
  bookingCancellation: {
    friendly_name: 'nabatable_booking_cancellation_20260714_v3',
    language: 'en',
    variables: {
      '1': 'The Old Crown Girton',
      '2': 'Sat, 18 Jul 2026 at 19:00 | 4 guests',
      '3': 'Reference: NBT-1234',
      '4': 'Contact: 01223 000000',
    },
    types: {
      'twilio/text': {
        body: 'Your booking at {{1}} has been cancelled as requested.\n\n{{2}}\n{{3}}\n\nNeed help?\n{{4}}\n\nWe hope to welcome you another time.',
      },
    },
  },
  restaurantCancellation: {
    friendly_name: 'nabatable_restaurant_cancellation_20260714_v3',
    language: 'en',
    variables: {
      '1': 'The Old Crown Girton',
      '2': 'Sat, 18 Jul 2026 at 19:00 | 4 guests',
      '3': 'Reference: NBT-1234',
      '4': 'Contact: 01223 000000',
    },
    types: {
      'twilio/text': {
        body: 'We’re sorry, {{1}} has had to cancel your booking.\n\n{{2}}\n{{3}}\n\nIf you would like help finding another time:\n{{4}}\n\nWe apologise for the inconvenience.',
      },
    },
  },
  reviewRequest: {
    friendly_name: 'nabatable_post_visit_review_20260714_v4',
    language: 'en',
    variables: {
      '1': 'The Old Crown Girton',
      '2': 'm/review-sample',
    },
    types: {
      'twilio/call-to-action': {
        body: 'Thank you for visiting {{1}}.\n\nWe hope you enjoyed your visit. Your feedback helps the team and future guests.\n\nTap the button below to leave a quick review.\n\nThank you for your support.',
        actions: [
          {
            type: 'URL',
            title: 'Leave a review',
            url: 'https://go.nabatable.com/{{2}}',
          },
        ],
      },
    },
  },
} as const;

export const MANAGER_DAILY_SUMMARY_TEMPLATE_REQUEST = {
  friendly_name: 'nabatable_manager_daily_summary_20260714_v3',
  language: 'en',
  variables: {
    '1': 'The Old Crown Girton: Today 8 bookings, 24 covers. Lunch 3 bookings / 8 covers. Dinner 5 bookings / 16 covers. app.nabatable.com',
  },
  types: {
    'twilio/text': {
      body: 'Your daily booking summary is ready.\n\n{{1}}\n\nOpen Nabatable to review today’s bookings and prepare for service.\n\nYou’re receiving this because daily summaries are enabled in your restaurant notification settings.',
    },
  },
} as const;

export const WHATSAPP_TEMPLATE_REQUESTS = {
  ...GUEST_TEMPLATE_REQUESTS,
  managerDailySummary: MANAGER_DAILY_SUMMARY_TEMPLATE_REQUEST,
} as const;

export const REVIEW_TEMPLATE_REQUEST = {
  friendly_name: 'nabatable_post_visit_review_20260713_v3',
  language: 'en',
  variables: {
    '1': 'The Old Crown',
    '2': 'm/review-sample',
  },
  types: {
    'twilio/call-to-action': {
      body: reviewBody,
      actions: [
        {
          type: 'URL',
          title: 'Leave a review',
          url: 'https://go.nabatable.com/{{2}}',
        },
      ],
    },
  },
} as const;

export function validateGuestTemplateRequests(input: unknown): readonly string[] {
  const parsed = guestTemplateRequestsSchema.safeParse(input);
  if (!parsed.success) {
    return ['Guest template requests do not match the provider schema.'];
  }

  return validateTemplateRequests(parsed.data, guestTemplateKeys, GUEST_TEMPLATE_REQUESTS);
}

export function validateWhatsAppTemplateRequests(input: unknown): readonly string[] {
  const parsed = whatsappTemplateRequestsSchema.safeParse(input);
  if (!parsed.success) {
    return ['WhatsApp template requests do not match the provider schema.'];
  }

  return validateTemplateRequests(parsed.data, templateKeys, WHATSAPP_TEMPLATE_REQUESTS);
}

function validateTemplateRequests<Key extends TemplateKey>(
  requests: Readonly<Record<Key, z.infer<typeof guestTemplateRequestSchema>>>,
  keys: readonly Key[],
  expectedRequests: Readonly<Record<Key, unknown>>,
): readonly string[] {
  const blockers: string[] = [];
  for (const key of keys) {
    const request = requests[key];
    const expected = expectedRequests[key];
    if (JSON.stringify(request) !== JSON.stringify(expected)) {
      blockers.push(`${key} request does not match the approved contract.`);
    }

    const content = request.types;
    const body =
      'twilio/call-to-action' in content
        ? content['twilio/call-to-action'].body
        : content['twilio/text'].body;
    if (/^\s*{{\d+}}|{{\d+}}\s*$/.test(body)) {
      blockers.push(`${key} body must not start or end with a variable.`);
    }

    const actionUrls =
      'twilio/call-to-action' in content
        ? content['twilio/call-to-action'].actions.map((action) => action.url).join('\n')
        : '';
    const referencedVariables = new Set(
      [...`${body}\n${actionUrls}`.matchAll(/{{(\d+)}}/g)].map((match) => match[1]),
    );
    for (const variable of referencedVariables) {
      if (!request.variables[variable]?.trim()) {
        blockers.push(`${key} variable {{${variable}}} requires a provider sample.`);
      }
    }
  }

  return blockers;
}

export function validateReviewTemplateRequest(_input: unknown): readonly string[] {
  const parsed = reviewTemplateSchema.safeParse(_input);
  if (!parsed.success) {
    return ['Review template request does not match the provider schema.'];
  }

  const blockers: string[] = [];
  const callToAction = parsed.data.types['twilio/call-to-action'];
  const action = callToAction.actions.at(0);
  if (parsed.data.friendly_name !== 'nabatable_post_visit_review_20260713_v3') {
    blockers.push('Review template friendly name does not match the selected template.');
  }
  if (parsed.data.language !== 'en') {
    blockers.push('Review template language must be en.');
  }
  if (callToAction.body !== reviewBody) {
    blockers.push('Review template body does not match the approved copy.');
  }
  if (/{{\d+}}\s*$/.test(callToAction.body)) {
    blockers.push('Review template body must not end in a variable.');
  }
  if (action?.type !== 'URL' || action.title !== 'Leave a review') {
    blockers.push('Review template must have one native Leave a review URL action.');
  }
  if (action?.url !== 'https://go.nabatable.com/{{2}}') {
    blockers.push('Review action URL must be https://go.nabatable.com/{{2}}.');
  }
  if (
    parsed.data.variables['1'] !== 'The Old Crown' ||
    parsed.data.variables['2'] !== 'm/review-sample'
  ) {
    blockers.push(
      'Review template variable samples do not match the provider submission contract.',
    );
  }

  return blockers;
}

export function assessWhatsAppTemplateReadiness({
  sender,
  selectedContentSids,
  recordedCategories,
  templates,
}: ReadinessInput): {
  readonly ready: boolean;
  readonly blockers: readonly string[];
} {
  const blockers: string[] = [];
  if (!/^\+[1-9][0-9]{6,14}$/.test(sender)) {
    blockers.push('WhatsApp sender is missing or invalid.');
  }

  for (const key of templateKeys) {
    const selectedSid = selectedContentSids[key];
    const template = templates.find((candidate) => candidate.key === key);
    if (!/^HX[0-9a-fA-F]{32}$/.test(selectedSid)) {
      blockers.push(`${key} Content SID is missing or invalid.`);
      continue;
    }
    if (!template || template.sid !== selectedSid) {
      blockers.push(`${key} provider readback is missing or does not match its selected SID.`);
      continue;
    }
    const normalizedStatus = template.status.toLowerCase();
    if (normalizedStatus !== 'approved') {
      blockers.push(`${key} is ${normalizedStatus || 'unknown'}; approved is required.`);
    }
    const normalizedCategory = template.category.toUpperCase();
    const recordedCategory = recordedCategories[key].trim().toUpperCase();
    if (recordedCategory.length === 0) {
      blockers.push(`${key} has no recorded provider-assigned category.`);
    } else if (normalizedCategory !== recordedCategory) {
      blockers.push(
        `${key} category is ${normalizedCategory || 'UNKNOWN'}; expected ${recordedCategory}.`,
      );
    }
    if (template.rejectionReason.trim().length > 0) {
      blockers.push(`${key} has a provider rejection reason.`);
    }
  }

  return { ready: blockers.length === 0, blockers };
}
