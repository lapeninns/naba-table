/**
 * Phase 2 of the GBP Dual-Sync V2 architecture. Attributes diff adapter.
 */

import { buildDiffItem, valuesEqual } from '../util';

import type { SyncV2AttributeValue } from '../../snapshot/types';
import type { SyncV2DiffItem } from '../../types';

function attributeResourceName(attribute: SyncV2AttributeValue | null): string | null {
  if (!attribute) return null;
  return attribute.attributeName ?? attribute.attributeId ?? attribute.attributeKey;
}

function looksLikeRawEnumValue(value: string): boolean {
  return value.trim().length > 0 && !/\s/.test(value);
}

function hasWritableAttributeValue(attribute: SyncV2AttributeValue): boolean {
  const valueType = attribute.valueType.toUpperCase();
  if (valueType.includes('BOOL')) return typeof attribute.boolValue === 'boolean';
  if (valueType.includes('URL')) {
    return Boolean(attribute.uriValue || attribute.uriValues.length > 0);
  }
  if (valueType.includes('ENUM')) {
    const values = [...attribute.enumValues, ...attribute.unsetEnumValues];
    return values.length > 0 && values.every(looksLikeRawEnumValue);
  }
  if (valueType.includes('STRING')) return Boolean(attribute.textValue);
  return Boolean(attribute.textValue || typeof attribute.boolValue === 'boolean');
}

export function diffBusinessContextAttributes(
  nabatable: ReadonlyArray<SyncV2AttributeValue>,
  google: ReadonlyArray<SyncV2AttributeValue>,
): ReadonlyArray<SyncV2DiffItem<SyncV2AttributeValue | null, SyncV2AttributeValue | null>> {
  const items: Array<SyncV2DiffItem<SyncV2AttributeValue | null, SyncV2AttributeValue | null>> = [];
  const keys = new Set<string>();
  for (const a of nabatable) keys.add(a.attributeKey);
  for (const a of google) keys.add(a.attributeKey);
  let sortOrder = 0;
  for (const key of [...keys].sort()) {
    const n = nabatable.find((a) => a.attributeKey === key) ?? null;
    const g = google.find((a) => a.attributeKey === key) ?? null;
    if (valuesEqual(n, g)) continue;
    const canExport = n === null ? Boolean(attributeResourceName(g)) : hasWritableAttributeValue(n);
    items.push(
      buildDiffItem<SyncV2AttributeValue | null, SyncV2AttributeValue | null>({
        sectionKey: 'businessContext.attributes',
        fieldKey: key,
        nabatable: n,
        google: g,
        canImport: g !== null,
        canExport,
        googleUpdateMask: 'attributes',
        blockedReasons: canExport
          ? undefined
          : ['Attribute export requires a writable value and Google attribute resource name.'],
        sortOrder,
      }),
    );
    sortOrder += 1;
  }
  return items;
}
