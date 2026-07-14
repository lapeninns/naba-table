import { describe, expect, it } from 'vitest';

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
