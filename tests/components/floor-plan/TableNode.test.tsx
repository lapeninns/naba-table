import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TableNode } from '@/components/features/floor-plan/TableNode';

import type { ProjectedTable } from '@/components/features/floor-plan/domain/project';
import type { FloorPlanTable } from '@/components/features/floor-plan/domain/types';
import type { FloorPlanNode } from '@/components/features/floor-plan/useFloorPlanState';

function makeTable(overrides: Partial<FloorPlanTable> = {}): FloorPlanTable {
  return {
    id: 't1',
    restaurantId: 'r1',
    tableNumber: '1',
    capacity: 2,
    minPartySize: 1,
    maxPartySize: null,
    section: null,
    category: 'dining',
    seatingType: 'standard',
    mobility: 'movable',
    zoneId: 'z1',
    zoneName: 'Main dining',
    zoneActive: true,
    active: true,
    status: 'available' as FloorPlanTable['status'],
    position: null,
    notes: null,
    segments: [],
    ...overrides,
  };
}

function makeNode(overrides: Partial<FloorPlanNode> = {}): FloorPlanNode {
  return {
    table: makeTable(),
    position: { xPercent: 0, yPercent: 0, rotation: 0 },
    resolved: { state: 'free', segment: null, booking: null, outOfService: false },
    isSelected: false,
    dimmed: false,
    ...overrides,
  };
}

const projected: ProjectedTable = {
  id: 't1',
  left: 100,
  top: 100,
  w: 46,
  h: 46,
  r: '50%',
  cx: 123,
  cy: 123,
};

function renderNode(opts: { draggable?: boolean; coarsePointer?: boolean; scale?: number } = {}) {
  const onSelect = vi.fn();
  const onDragMoveClient = vi.fn();
  const onDragCommit = vi.fn();
  render(
    <TableNode
      node={makeNode()}
      projected={projected}
      draggable={opts.draggable ?? true}
      timezone="Europe/London"
      scale={opts.scale ?? 0.4}
      coarsePointer={opts.coarsePointer ?? true}
      onSelect={onSelect}
      onDragMoveClient={onDragMoveClient}
      onDragCommit={onDragCommit}
    />,
  );
  return { onSelect, onDragMoveClient, onDragCommit };
}

describe('TableNode interaction', () => {
  it('selects on touch and never commits a layout move, even if the finger drifts', () => {
    const { onSelect, onDragMoveClient, onDragCommit } = renderNode({ draggable: true });
    const button = screen.getByRole('button', { name: /table 1/i });
    fireEvent.pointerDown(button, {
      pointerType: 'touch',
      clientX: 100,
      clientY: 100,
      pointerId: 1,
    });
    fireEvent.pointerMove(button, {
      pointerType: 'touch',
      clientX: 130,
      clientY: 132,
      pointerId: 1,
    });
    fireEvent.pointerUp(button, { pointerType: 'touch', clientX: 130, clientY: 132, pointerId: 1 });
    expect(onSelect).toHaveBeenCalledWith('t1');
    expect(onDragMoveClient).not.toHaveBeenCalled();
    expect(onDragCommit).not.toHaveBeenCalled();
  });

  it('keeps mouse/pen drag-to-move on a movable table', () => {
    const { onSelect, onDragMoveClient, onDragCommit } = renderNode({ draggable: true });
    const button = screen.getByRole('button', { name: /table 1/i });
    fireEvent.pointerDown(button, {
      pointerType: 'mouse',
      clientX: 100,
      clientY: 100,
      pointerId: 2,
    });
    fireEvent.pointerMove(button, {
      pointerType: 'mouse',
      clientX: 180,
      clientY: 140,
      pointerId: 2,
    });
    fireEvent.pointerUp(button, { pointerType: 'mouse', clientX: 180, clientY: 140, pointerId: 2 });
    expect(onDragMoveClient).toHaveBeenCalled();
    expect(onDragCommit).toHaveBeenCalledWith('t1');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('selects on a mouse press-release without movement', () => {
    const { onSelect, onDragCommit } = renderNode({ draggable: true });
    const button = screen.getByRole('button', { name: /table 1/i });
    fireEvent.pointerDown(button, {
      pointerType: 'mouse',
      clientX: 100,
      clientY: 100,
      pointerId: 3,
    });
    fireEvent.pointerUp(button, { pointerType: 'mouse', clientX: 100, clientY: 100, pointerId: 3 });
    expect(onSelect).toHaveBeenCalledWith('t1');
    expect(onDragCommit).not.toHaveBeenCalled();
  });

  it('selects a movable table via keyboard activation (click with detail 0)', () => {
    const { onSelect } = renderNode({ draggable: true });
    fireEvent.click(screen.getByRole('button', { name: /table 1/i }), { detail: 0 });
    expect(onSelect).toHaveBeenCalledWith('t1');
  });

  it('carries the service-state label in the accessible name (status never colour-only)', () => {
    renderNode({ draggable: false });
    expect(screen.getByRole('button', { name: 'Table 1, 2 seats, Free' })).toBeInTheDocument();
  });

  it('renders an unscaled coarse-pointer touch expander sized to the 44px floor', () => {
    renderNode({ draggable: true, coarsePointer: true, scale: 0.4 });
    const button = screen.getByRole('button', { name: /table 1/i });
    const expander = button.querySelector<HTMLElement>('[data-floor-touch-target]');
    expect(expander).not.toBeNull();
    // 46px tile × 0.4 → needs 110px content box → 32px padding each side.
    expect(expander!.style.left).toBe('-32px');
    expect(expander!.style.top).toBe('-32px');
  });

  it('omits the touch expander on fine pointers', () => {
    renderNode({ draggable: true, coarsePointer: false, scale: 0.4 });
    const button = screen.getByRole('button', { name: /table 1/i });
    expect(button.querySelector('[data-floor-touch-target]')).toBeNull();
  });
});
