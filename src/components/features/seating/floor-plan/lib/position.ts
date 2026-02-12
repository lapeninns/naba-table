export type NormalizedPosition = { x: number; y: number; rotation: number };

export function normalizePosition(value: unknown): NormalizedPosition | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  const x = typeof record.x === 'number' ? record.x : null;
  const y = typeof record.y === 'number' ? record.y : null;
  if (x === null || y === null) {
    return null;
  }
  const rotation = typeof record.rotation === 'number' ? record.rotation : 0;
  return { x, y, rotation };
}

