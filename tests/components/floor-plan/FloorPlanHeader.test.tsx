import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FloorPlanHeader } from '@/components/features/floor-plan/FloorPlanHeader';

describe('FloorPlanHeader', () => {
  it('renders the venue heading, summary, status badge, and refresh', () => {
    render(
      <FloorPlanHeader
        venueName="The Brasserie"
        summary="13 tables · 3 zones · 46 covers"
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'The Brasserie' })).toBeInTheDocument();
    expect(screen.getByText('13 tables · 3 zones · 46 covers')).toBeInTheDocument();
    expect(screen.getByText('Service operational')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });

  it('leaves no standalone separator glyph that could dangle when the badge wraps on mobile', () => {
    // Audited mobile defect: a "•" between summary and the "Service operational" badge strands
    // on the summary line when the badge wraps to its own row. The summary's own internal
    // separators are "·" (middot); the orphan-prone glyph was a standalone "•" (bullet).
    render(
      <FloorPlanHeader
        venueName="X"
        summary="13 tables · 3 zones · 46 covers"
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.queryByText('•')).toBeNull();
  });
});
