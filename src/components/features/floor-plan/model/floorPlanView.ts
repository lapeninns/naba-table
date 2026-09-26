/** What fills the floor plan's main area once the data has loaded. */
export type FloorPlanBody = 'canvas' | 'list' | 'timeline';

export function floorPlanBody({
  mode,
  view,
  listOn,
  phone,
}: {
  mode: 'service' | 'arrange';
  view: 'plan' | 'timeline';
  listOn: boolean;
  phone: boolean;
}): FloorPlanBody {
  if (mode === 'service' && view === 'timeline') return 'timeline';
  if (listOn) return 'list';
  // Phones get the list during service, but arranging needs the canvas: the list can't move
  // tables, and the canvas handles touch drags.
  if (phone && mode === 'service') return 'list';
  return 'canvas';
}
