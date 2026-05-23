import { normalizeText } from './businessInfoNormalization';

export function extractLastSegment(value: string | null | undefined): string | null {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  const segments = normalized.split('/');
  return segments.length > 0 ? normalizeText(segments[segments.length - 1]) : normalized;
}

export function pickPlaceDisplayName(place: Record<string, unknown>): string | null {
  const directCandidates = [
    place.displayName,
    place.placeName,
    place.name,
    place.localizedName,
    place.address,
  ];

  for (const candidate of directCandidates) {
    const normalized = normalizeText(typeof candidate === 'string' ? candidate : null);
    if (normalized) {
      return normalized;
    }
  }

  const nestedDisplayName = place.displayName;
  if (
    nestedDisplayName &&
    typeof nestedDisplayName === 'object' &&
    'text' in nestedDisplayName &&
    typeof nestedDisplayName.text === 'string'
  ) {
    return normalizeText(nestedDisplayName.text);
  }

  return null;
}

export function deriveLinkTypeFromAttribute(attributeKey: string): string {
  const normalized = attributeKey.toLowerCase();
  if (normalized.includes('menu')) {
    return 'menu_or_services';
  }
  if (normalized.includes('reservation')) {
    return 'reservation';
  }
  if (normalized.includes('order')) {
    return 'order';
  }
  if (normalized.includes('service')) {
    return 'menu_or_services';
  }
  return 'other';
}

export function normalizeServiceAreaType(value: string | null | undefined): string {
  const normalized = normalizeText(value)?.toLowerCase() ?? null;
  switch (normalized) {
    case 'region':
      return 'region';
    case 'postal_code':
    case 'postal_codes':
      return 'postal_code';
    case 'place':
      return 'place';
    default:
      return 'other';
  }
}

export function normalizeAttributeValueType(value: string | null | undefined): string {
  const normalized = normalizeText(value)?.toUpperCase() ?? null;
  switch (normalized) {
    case 'BOOL':
    case 'BOOLEAN':
      return 'boolean';
    case 'URL':
    case 'URI':
      return 'uri';
    case 'ENUM':
      return 'enum';
    case 'REPEATED_ENUM':
    case 'MULTIENUM':
      return 'multienum';
    default:
      return 'text';
  }
}

export function buildAttributeDisplayText(input: {
  displayName: string | null;
  boolValue: boolean | null;
  textValue: string | null;
  uriValue: string | null;
  enumValues: string[];
  positiveLabel: string | null;
  negativeLabel: string | null;
}): string | null {
  if (input.boolValue === true) {
    return input.positiveLabel ?? input.displayName;
  }

  if (input.boolValue === false) {
    return input.negativeLabel ?? input.displayName;
  }

  if (input.enumValues.length > 0) {
    return input.displayName
      ? `${input.displayName}: ${input.enumValues.join(', ')}`
      : input.enumValues.join(', ');
  }

  if (input.textValue) {
    return input.displayName ? `${input.displayName}: ${input.textValue}` : input.textValue;
  }

  if (input.uriValue) {
    return input.displayName ? `${input.displayName}: ${input.uriValue}` : input.uriValue;
  }

  return input.displayName;
}
