import { describe, expect, it } from 'vitest';

import {
  buildDisplayValueJson,
  buildRawAttributeValueJson,
  buildRawEnumValuesJson,
  normalizeAttributeValueMetadata,
} from '@/server/google-business-profile/businessInfoAttributeNormalization';

describe('google business profile business info attribute normalization', () => {
  it('normalizes attribute value metadata while filtering empty entries', () => {
    expect(
      normalizeAttributeValueMetadata([
        { value: true, displayName: ' Yes ' },
        { value: 'ENUM_VALUE', displayName: '' },
        { value: undefined, displayName: 'Label only' },
        { value: undefined, displayName: '' },
      ]),
    ).toEqual([
      { value: true, displayName: 'Yes' },
      { value: 'ENUM_VALUE', displayName: null },
      { value: null, displayName: 'Label only' },
    ]);
  });

  it('builds raw attribute value JSON with stable defaults', () => {
    expect(
      buildRawAttributeValueJson({
        valueType: 'URL',
        uriValue: 'https://example.com',
        values: [{ stringValue: 'booking' }],
      } as never),
    ).toEqual({
      valueType: 'URL',
      values: [{ stringValue: 'booking' }],
      repeatedEnumValue: null,
      uriValue: 'https://example.com',
      uriValues: [],
      valueMetadata: [],
    });
  });

  it('builds raw enum and display value payloads', () => {
    const valueMetadata = normalizeAttributeValueMetadata([
      { value: 'PAY_CARD', displayName: 'Card' },
    ]);

    expect(
      buildRawEnumValuesJson({
        setValues: ['PAY_CARD'],
        unsetValues: ['PAY_CASH'],
        valueEnumValues: ['PAY_PHONE'],
      }),
    ).toEqual({
      setValues: ['PAY_CARD'],
      unsetValues: ['PAY_CASH'],
      valueEnumValues: ['PAY_PHONE'],
    });
    expect(
      buildDisplayValueJson({
        displayName: 'Payments',
        displayStrings: undefined,
        enumValues: ['Pay Card'],
        unsetEnumValues: ['Pay Cash'],
        valueDisplays: ['Pay Card'],
        uriValues: [],
        valueMetadata,
      }),
    ).toEqual({
      displayName: 'Payments',
      displayStrings: null,
      enumValues: ['Pay Card'],
      unsetEnumValues: ['Pay Cash'],
      valueDisplays: ['Pay Card'],
      uriValues: [],
      valueMetadata,
    });
  });
});
