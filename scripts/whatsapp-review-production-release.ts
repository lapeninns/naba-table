import { z } from 'zod';

const templateKeys = [
  'bookingConfirmation',
  'bookingUpdate',
  'bookingCancellation',
  'restaurantCancellation',
  'reviewRequest',
] as const;

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

const reviewBody =
  'Thanks for visiting {{1}}.\n\nWe hope you enjoyed your visit. Your feedback helps our team and future guests.\n\nTap below to leave a quick review.\n\nThank you for supporting us.';

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
