import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EmailTemplatesPreviewPane } from '@/src/components/features/email-templates/EmailTemplatesPreviewPane';

describe('EmailTemplatesPreviewPane', () => {
  it('renders srcDoc previews in a restrictive sandbox', () => {
    render(
      <EmailTemplatesPreviewPane
        previewDevice="desktop"
        onPreviewDeviceChange={vi.fn()}
        isLoading={false}
        errorMessage={null}
        preview={{
          templateKey: 'confirmation',
          selectedVariantId: 'variant-1',
          selectedVariantName: 'Variant',
          preheader: 'Preview',
          headline: 'Headline',
          intro: 'Intro',
          cue: '',
          ask: '',
          ctaLabel: 'Manage',
          ctaUrl: 'https://nabatable.com/bookings/recover/error?code=test',
          subject: 'Subject',
          html: '<script>parent.fetch("/api/ops/restaurants")</script>',
          text: 'Plain text',
        }}
      />,
    );

    const iframe = screen.getByTitle('desktop email preview');
    expect(iframe).toHaveAttribute('sandbox', '');
    expect(iframe).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(iframe).toHaveAttribute('srcdoc');
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-scripts');
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-same-origin');
  });
});
