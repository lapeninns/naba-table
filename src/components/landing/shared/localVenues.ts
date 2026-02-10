// Shared sample venues for landing-page proof widgets (live feed, testimonials).
// Keep as a single source of truth so "Proof" sections stay consistent.
export const LOCAL_VENUES = [
  'The Barley Mow Pub — Hartford',
  "The Queen Elizabeth Pub — King's Lynn",
  'Prince of Wales Pub — Bromham',
  'White Horse Pub — Waterbeach',
  'The Corner House Pub — Cambridge',
  'Old Crown Pub — Girton',
  'The Bell — Sawtry',
  'The Railway Pub — Whittlesey',
] as const;

export function venueNameFromLabel(label: string) {
  // Labels are formatted as "<venue> — <town>".
  return label.split(' — ')[0] ?? label;
}

