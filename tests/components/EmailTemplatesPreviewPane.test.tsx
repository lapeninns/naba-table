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

describe('EmailTemplatesPreviewPane states', () => {
  const preview = {
    templateKey: 'confirmation' as const,
    selectedVariantId: 'variant-1',
    selectedVariantName: 'Variant',
    preheader: 'Preview',
    headline: 'Headline',
    intro: 'Intro',
    cue: '',
    ask: '',
    ctaLabel: 'Manage',
    ctaUrl: 'https://nabatable.com',
    subject: 'Subject',
    html: '<p>Hi</p>',
    text: 'Plain text',
  };

  it('keeps the previous render visible while a newer draft is rendering', () => {
    render(
      <EmailTemplatesPreviewPane
        previewDevice="desktop"
        onPreviewDeviceChange={vi.fn()}
        isLoading={false}
        isRefreshing
        errorMessage={null}
        preview={preview}
      />,
    );

    expect(screen.getByText('Updating preview…')).toBeInTheDocument();
    expect(screen.getByTitle('desktop email preview')).toBeInTheDocument();
  });

  it('shows the preview error instead of a stale render', () => {
    render(
      <EmailTemplatesPreviewPane
        previewDevice="desktop"
        onPreviewDeviceChange={vi.fn()}
        isLoading={false}
        errorMessage="The preview is paused after too many updates."
        preview={preview}
      />,
    );

    expect(screen.getByText('Preview unavailable')).toBeInTheDocument();
    expect(screen.getByText('The preview is paused after too many updates.')).toBeInTheDocument();
  });
});
