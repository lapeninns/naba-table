const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function words(value: string): string {
  const text = value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_]+/g, ' ')
    .replace(/\bwi fi\b/gi, 'Wi-Fi')
    .replace(/\bnfc\b/gi, 'NFC')
    .replace(/\blgbtq\b/gi, 'LGBTQ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatDualSyncFieldLabel(label: string, sectionKey?: string): string {
  if (!label.startsWith('attributes/') && sectionKey !== 'businessContext.attributes') return label;
  return words(
    label
      .replace(/^attributes\//, '')
      .replace(/^has_/, '')
      .replace(/^pay_/, 'accepts_'),
  );
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function list(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function timeRange(start: unknown, end: unknown): string {
  const from = text(start);
  const to = text(end);
  if (!from && !to) return 'Hours not set';
  const overnight = /^\d{2}:\d{2}$/.test(from) && /^\d{2}:\d{2}$/.test(to) && to < from;
  return `${from || 'Not set'}–${to || 'Not set'}${overnight ? ' (next day)' : ''}`;
}

function attribute(value: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof value.boolValue === 'boolean') parts.push(value.boolValue ? 'Yes' : 'No');
  if (text(value.textValue)) parts.push(text(value.textValue));
  const urls = [...new Set([text(value.uriValue), ...list(value.uriValues)].filter(Boolean))];
  parts.push(...urls);
  const offered = list(value.enumValues).map(words);
  if (offered.length) parts.push(offered.join(', '));
  const excluded = list(value.unsetEnumValues).map(words);
  if (excluded.length) parts.push(`Not offered: ${excluded.join(', ')}`);
  return parts.join(' · ') || 'Not set';
}

function menuItem(value: Record<string, unknown>): string {
  const parts = [text(value.itemName), text(value.sectionLabel), text(value.description)];
  if (typeof value.basePrice === 'number' && Number.isFinite(value.basePrice)) {
    parts.push(`${text(value.currency)} ${value.basePrice.toFixed(2)}`.trim());
  }
  const tags = list(value.dietaryTags).map(words);
  if (tags.length) parts.push(`Dietary tags: ${tags.join(', ')}`);
  const allergens = list(value.allergensContains).map(words);
  if (allergens.length) parts.push(`Allergens: ${allergens.join(', ')}`);
  return parts.filter(Boolean).join(' · ');
}

function knownObject(value: Record<string, unknown>): string | null {
  if ('isClosed' in value && ('opensAt' in value || 'closesAt' in value)) {
    return value.isClosed === true ? 'Closed' : timeRange(value.opensAt, value.closesAt);
  }
  if ('startTime' in value && 'endTime' in value && 'bookingOption' in value) {
    const day = typeof value.dayOfWeek === 'number' ? DAYS[value.dayOfWeek] : null;
    return [
      text(value.name),
      day,
      timeRange(value.startTime, value.endTime),
      text(value.bookingOption) ? `Booking option: ${words(text(value.bookingOption))}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  if (typeof value.displayName === 'string' && typeof value.isPrimary === 'boolean') {
    return `${value.displayName} · ${value.isPrimary ? 'Primary' : 'Additional'} category`;
  }
  if (typeof value.displayName === 'string' && 'areaType' in value) {
    return [value.displayName, text(value.regionCode)].filter(Boolean).join(' · ');
  }
  if ('attributeKey' in value && 'valueType' in value) return attribute(value);
  if ('itemName' in value && 'basePrice' in value) return menuItem(value);
  return null;
}

function preview(value: unknown, ancestors: ReadonlySet<object>): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value.trim().length === 0 ? '—' : value;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value !== 'object' || ancestors.has(value)) return 'Unavailable';
  const next = new Set([...ancestors, value]);
  if (Array.isArray(value)) return value.map((item) => preview(item, next)).join('; ') || 'None';
  const object = value as Record<string, unknown>;
  return (
    knownObject(object) ??
    (Object.entries(object)
      .map(([key, item]) => `${words(key)}: ${preview(item, next)}`)
      .join(' · ') ||
      'Not set')
  );
}

export function formatDualSyncFieldPreview(value: unknown): string {
  return preview(value, new Set());
}
