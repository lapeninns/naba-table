import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FloorPlanClient } from '@/components/features/floor-plan/FloorPlanClient';

import { snapshot } from './floorPlanFixtures';

const session = vi.hoisted(() => ({ role: 'owner' as string | null }));
const plan = vi.hoisted(() => ({ snapshot: null as unknown }));

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('@/contexts/ops-session', () => ({
  useOpsActiveRestaurantId: () => 'rest-1',
  useOpsActiveMembership: () => (session.role ? { role: session.role } : null),
}));
vi.mock('@/contexts/ops-unsaved-changes', () => ({ useRegisterOpsUnsavedChanges: vi.fn() }));
vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => false }));
vi.mock('@/hooks/ops/useOpsFloorPlan', () => ({
  useOpsFloorPlan: () => ({
    status: 'ready',
    snapshot: plan.snapshot,
    failedSources: [],
    error: null,
    refreshError: null,
    updatedAt: null,
    isRefreshing: false,
    isRealtime: false,
    refresh: vi.fn(),
  }),
}));
vi.mock('@/hooks/ops/useOpsFloorPlanAssignments', () => ({
  toAssignmentError: vi.fn(),
  useOpsFloorPlanAssignments: () => ({
    pending: [],
    assign: vi.fn(),
    move: vi.fn(),
    unassign: vi.fn(),
  }),
}));
vi.mock('@/hooks/ops/useOpsFloorPlanLayout', () => ({
  useOpsFloorPlanLayoutSave: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/ops/useOpsFloorPlanLifecycle', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, useOpsFloorPlanLifecycle: () => ({ run: vi.fn(), busy: {} }) };
});

describe('floor plan links into settings', () => {
  beforeEach(() => {
    plan.snapshot = { ...snapshot(), tables: [] };
  });

  it('sends admins with no tables to Tables settings', () => {
    session.role = 'owner';
    render(<FloorPlanClient initialDate={null} />);

    expect(screen.getByRole('link', { name: 'Go to Tables settings' })).toHaveAttribute(
      'href',
      '/app/settings/restaurant/tables',
    );
  });

  it('asks hosts to get a manager instead of linking to admin-only settings', () => {
    session.role = 'host';
    render(<FloorPlanClient initialDate={null} />);

    expect(screen.queryByRole('link', { name: 'Go to Tables settings' })).not.toBeInTheDocument();
    expect(
      screen.getByText(/Ask a manager to add tables and zones in settings/),
    ).toBeInTheDocument();
  });
});
