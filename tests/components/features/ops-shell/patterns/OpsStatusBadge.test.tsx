import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OpsStatusBadge } from '@/components/features/ops-shell/patterns/OpsStatusBadge';
import { OPS_STATUS_TONE_CLASSES } from '@/lib/ops/status-tones';

describe('OpsStatusBadge', () => {
  it('@smoke renders the label with neutral tone classes by default', () => {
    render(<OpsStatusBadge label="Pending" />);

    const badge = screen.getByText('Pending');
    for (const cls of OPS_STATUS_TONE_CLASSES.neutral.split(' ').filter(Boolean)) {
      expect(badge).toHaveClass(cls);
    }
  });

  it('@smoke maps each semantic tone to its centralized tone classes', () => {
    const tones = ['neutral', 'success', 'warning', 'danger', 'info', 'muted'] as const;

    for (const tone of tones) {
      const { unmount } = render(<OpsStatusBadge label={`tone-${tone}`} tone={tone} />);
      const badge = screen.getByText(`tone-${tone}`);
      for (const cls of OPS_STATUS_TONE_CLASSES[tone].split(' ').filter(Boolean)) {
        expect(badge).toHaveClass(cls);
      }
      unmount();
    }
  });

  it("@smoke treats the 'default' tone as an alias for neutral", () => {
    render(<OpsStatusBadge label="Aliased" tone="default" />);

    const badge = screen.getByText('Aliased');
    for (const cls of OPS_STATUS_TONE_CLASSES.neutral.split(' ').filter(Boolean)) {
      expect(badge).toHaveClass(cls);
    }
  });
});
