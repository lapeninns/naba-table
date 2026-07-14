import { describe, expect, it } from 'vitest';

import * as releaseContract from '@/scripts/whatsapp-review-production-release';
import {
  assessWhatsAppTemplateReadiness,
  REVIEW_TEMPLATE_REQUEST,
  validateReviewTemplateRequest,
} from '@/scripts/whatsapp-review-production-release';

const selectedContentSids = {
  bookingConfirmation: 'HX78688ba4f6738f6fc3a8208c300ac911',
  bookingUpdate: 'HXa2ff8bb1dfe84884e93ed3d00b8aa1d4',
  bookingCancellation: 'HXbc2317fae04cde871d5fb697d40cfe7f',
  restaurantCancellation: 'HX1502dce2894a886555e35de67412f474',
  reviewRequest: 'HXb492923d7284f0fa2409917dd7d7b9a8',
} as const;

const approvedTemplates = [
  {
    key: 'bookingConfirmation',
    sid: selectedContentSids.bookingConfirmation,
    status: 'approved',
    category: 'UTILITY',
    rejectionReason: '',
  },
  {
    key: 'bookingUpdate',
    sid: selectedContentSids.bookingUpdate,
    status: 'approved',
    category: 'UTILITY',
    rejectionReason: '',
  },
  {
    key: 'bookingCancellation',
    sid: selectedContentSids.bookingCancellation,
    status: 'approved',
    category: 'UTILITY',
    rejectionReason: '',
  },
  {
    key: 'restaurantCancellation',
    sid: selectedContentSids.restaurantCancellation,
    status: 'approved',
    category: 'UTILITY',
    rejectionReason: '',
  },
  {
    key: 'reviewRequest',
    sid: selectedContentSids.reviewRequest,
    status: 'approved',
    category: 'MARKETING',
    rejectionReason: '',
  },
] as const;

const recordedCategories = {
  bookingConfirmation: 'UTILITY',
  bookingUpdate: 'UTILITY',
  bookingCancellation: 'UTILITY',
  restaurantCancellation: 'UTILITY',
  reviewRequest: 'MARKETING',
} as const;

type MutableTemplateRequests = Record<
  string,
  {
    variables: Record<string, string>;
    types: {
      'twilio/call-to-action'?: {
        body: string;
        actions: Array<{ url: string }>;
      };
      'twilio/text'?: { body: string };
    };
  }
>;

describe('guest WhatsApp template refresh contract', () => {
  it('defines the exact five operator-approved successor requests @contract', () => {
    const requests = (
      releaseContract as unknown as {
        GUEST_TEMPLATE_REQUESTS?: unknown;
      }
    ).GUEST_TEMPLATE_REQUESTS;

    expect(requests).toEqual({
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
    });
  });

  it('accepts the exact five-template set before provider submission @contract', () => {
    const validate = (
      releaseContract as unknown as {
        validateGuestTemplateRequests?: (input: unknown) => readonly string[];
      }
    ).validateGuestTemplateRequests;

    expect(validate?.(releaseContract.GUEST_TEMPLATE_REQUESTS)).toEqual([]);
  });

  it.each([
    {
      label: 'copy drift',
      mutate: (requests: MutableTemplateRequests) => {
        requests.bookingConfirmation.types['twilio/call-to-action']!.body = 'Different copy.';
      },
      blocker: 'bookingConfirmation request does not match the approved contract.',
    },
    {
      label: 'wrong update action origin',
      mutate: (requests: MutableTemplateRequests) => {
        requests.bookingUpdate.types['twilio/call-to-action']!.actions[0].url =
          'https://example.com/{{5}}';
      },
      blocker: 'bookingUpdate request does not match the approved contract.',
    },
    {
      label: 'wrong cancellation content type',
      mutate: (requests: MutableTemplateRequests) => {
        requests.bookingCancellation.types = {
          'twilio/call-to-action': {
            body: requests.bookingCancellation.types['twilio/text']!.body,
            actions: [],
          },
        };
      },
      blocker: 'bookingCancellation request does not match the approved contract.',
    },
    {
      label: 'ending body variable',
      mutate: (requests: MutableTemplateRequests) => {
        requests.restaurantCancellation.types['twilio/text']!.body =
          'Your booking was cancelled. {{4}}';
      },
      blocker: 'restaurantCancellation body must not start or end with a variable.',
    },
    {
      label: 'missing action sample',
      mutate: (requests: MutableTemplateRequests) => {
        delete requests.reviewRequest.variables['2'];
      },
      blocker: 'reviewRequest variable {{2}} requires a provider sample.',
    },
  ])('rejects $label before provider submission @contract', ({ mutate, blocker }) => {
    const validate = (
      releaseContract as unknown as {
        validateGuestTemplateRequests?: (input: unknown) => readonly string[];
      }
    ).validateGuestTemplateRequests;
    const requests = structuredClone(
      releaseContract.GUEST_TEMPLATE_REQUESTS,
    ) as unknown as MutableTemplateRequests;
    mutate(requests);

    expect(validate?.(requests)).toContain(blocker);
  });
});

describe('WhatsApp review production release contract', () => {
  it('defines the exact native review action without ending the body in a variable @contract', () => {
    const givenRequest = REVIEW_TEMPLATE_REQUEST;

    const whenBody = givenRequest.types['twilio/call-to-action'].body;

    expect(givenRequest).toEqual({
      friendly_name: 'nabatable_post_visit_review_20260713_v3',
      language: 'en',
      variables: {
        '1': 'The Old Crown',
        '2': 'm/review-sample',
      },
      types: {
        'twilio/call-to-action': {
          body: 'Thanks for visiting {{1}}.\n\nWe hope you enjoyed your visit. Your feedback helps our team and future guests.\n\nTap below to leave a quick review.\n\nThank you for supporting us.',
          actions: [
            {
              type: 'URL',
              title: 'Leave a review',
              url: 'https://go.nabatable.com/{{2}}',
            },
          ],
        },
      },
    });
    expect(whenBody).not.toMatch(/{{\d+}}\s*$/);
    expect(validateReviewTemplateRequest(givenRequest)).toEqual([]);
  });

  it('accepts only an approved five-template set matching its recorded categories @contract', () => {
    const whenResult = assessWhatsAppTemplateReadiness({
      sender: '+447700900000',
      selectedContentSids,
      recordedCategories,
      templates: approvedTemplates,
    });

    expect(whenResult).toEqual({ ready: true, blockers: [] });
  });

  it('accepts approved provider-assigned categories without assuming submitted categories @contract', () => {
    const providerAssignedTemplates = approvedTemplates.map((template) => ({
      ...template,
      category: template.key === 'reviewRequest' ? 'UTILITY' : 'MARKETING',
    }));
    const providerRecordedCategories = {
      bookingConfirmation: 'MARKETING',
      bookingUpdate: 'MARKETING',
      bookingCancellation: 'MARKETING',
      restaurantCancellation: 'MARKETING',
      reviewRequest: 'UTILITY',
    } as const;

    const whenResult = assessWhatsAppTemplateReadiness({
      sender: '+447700900000',
      selectedContentSids,
      recordedCategories: providerRecordedCategories,
      templates: providerAssignedTemplates,
    });

    expect(whenResult).toEqual({ ready: true, blockers: [] });
  });

  it.each([
    {
      label: 'wrong action origin',
      request: {
        ...REVIEW_TEMPLATE_REQUEST,
        types: {
          'twilio/call-to-action': {
            ...REVIEW_TEMPLATE_REQUEST.types['twilio/call-to-action'],
            actions: [
              {
                type: 'URL',
                title: 'Leave a review',
                url: 'https://example.com/{{2}}',
              },
            ],
          },
        },
      },
      blocker: 'Review action URL must be https://go.nabatable.com/{{2}}.',
    },
    {
      label: 'ending body variable',
      request: {
        ...REVIEW_TEMPLATE_REQUEST,
        types: {
          'twilio/call-to-action': {
            ...REVIEW_TEMPLATE_REQUEST.types['twilio/call-to-action'],
            body: 'Thanks for visiting {{1}}',
          },
        },
      },
      blocker: 'Review template body must not end in a variable.',
    },
  ])('rejects $label before provider submission @contract', ({ request, blocker }) => {
    const whenBlockers = validateReviewTemplateRequest(request);

    expect(whenBlockers).toContain(blocker);
  });

  it.each([
    {
      label: 'blank sender',
      sender: '',
      templates: approvedTemplates,
      blocker: 'WhatsApp sender is missing or invalid.',
    },
    {
      label: 'missing review SID',
      sender: '+447700900000',
      selectedContentSids: { ...selectedContentSids, reviewRequest: '' },
      templates: approvedTemplates,
      blocker: 'reviewRequest Content SID is missing or invalid.',
    },
    {
      label: 'pending template',
      sender: '+447700900000',
      templates: approvedTemplates.map((template) =>
        template.key === 'bookingUpdate' ? { ...template, status: 'pending' } : template,
      ),
      blocker: 'bookingUpdate is pending; approved is required.',
    },
    {
      label: 'missing category lock',
      sender: '+447700900000',
      recordedCategories: { ...recordedCategories, reviewRequest: '' },
      templates: approvedTemplates,
      blocker: 'reviewRequest has no recorded provider-assigned category.',
    },
    {
      label: 'rejected template',
      sender: '+447700900000',
      templates: approvedTemplates.map((template) =>
        template.key === 'reviewRequest'
          ? { ...template, status: 'rejected', rejectionReason: 'Policy violation' }
          : template,
      ),
      blocker: 'reviewRequest is rejected; approved is required.',
    },
    {
      label: 'material recategorization',
      sender: '+447700900000',
      templates: approvedTemplates.map((template) =>
        template.key === 'reviewRequest' ? { ...template, category: 'UTILITY' } : template,
      ),
      blocker: 'reviewRequest category is UTILITY; expected MARKETING.',
    },
  ])(
    'blocks activation for $label @contract',
    ({
      sender,
      selectedContentSids: selectedSids = selectedContentSids,
      recordedCategories: categoryLock = recordedCategories,
      templates,
      blocker,
    }) => {
      const whenResult = assessWhatsAppTemplateReadiness({
        sender,
        selectedContentSids: selectedSids,
        recordedCategories: categoryLock,
        templates,
      });

      expect(whenResult.ready).toBe(false);
      expect(whenResult.blockers).toContain(blocker);
    },
  );
});
