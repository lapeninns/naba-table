import { describe, expect, it } from 'vitest';

import {
  assessWhatsAppTemplateReadiness,
  REVIEW_TEMPLATE_REQUEST,
  validateReviewTemplateRequest,
} from '@/scripts/whatsapp-review-production-release';

const selectedContentSids = {
  bookingConfirmation: 'HX5314cca961d164966548d0a55fc85a57',
  bookingUpdate: 'HX2bc9fea6e092a5f8e4447bf2d40e0701',
  bookingCancellation: 'HX63714e1f2a8199cfe76e99afcb7d7018',
  restaurantCancellation: 'HX10d088b0511873455818bcd0b56d6b03',
  reviewRequest: 'HXa465c6d38370bf754fb401518620e5a0',
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

describe('WhatsApp review production release contract', () => {
  it('defines the exact native review action without ending the body in a variable @contract', () => {
    const givenRequest = REVIEW_TEMPLATE_REQUEST;

    const whenBody = givenRequest.types['twilio/call-to-action'].body;

    expect(givenRequest).toEqual({
      friendly_name: 'nabatable_post_visit_review_v1',
      language: 'en',
      variables: {
        '1': 'The Old Crown',
        '2': 'r/Review123456',
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
  });

  it('accepts only an approved five-template set with expected categories @contract', () => {
    const whenResult = assessWhatsAppTemplateReadiness({
      sender: '+447700900000',
      selectedContentSids,
      templates: approvedTemplates,
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
    ({ sender, selectedContentSids: selectedSids = selectedContentSids, templates, blocker }) => {
      const whenResult = assessWhatsAppTemplateReadiness({
        sender,
        selectedContentSids: selectedSids,
        templates,
      });

      expect(whenResult.ready).toBe(false);
      expect(whenResult.blockers).toContain(blocker);
    },
  );
});
