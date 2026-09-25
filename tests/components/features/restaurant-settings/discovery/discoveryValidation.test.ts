import { describe, expect, it } from 'vitest';

import { EMPTY_BUSINESS_CONTEXT_DRAFTS } from '@/components/features/restaurant-settings/businessContextDraftState';
import { EMPTY_DIRTY_STATE } from '@/components/features/restaurant-settings/businessContextModel';
import {
  collectDiscoveryIssues,
  countDiscoveryIssuesByFamily,
  isValidAttributeValueType,
} from '@/components/features/restaurant-settings/discovery/discoveryValidation';

import {
  makeAttributeRow,
  makeCategoryRow,
  makeLinkRow,
  makeServiceAreaRow,
  makeServiceItemRow,
} from '../testUtils';

import type { BusinessContextDrafts } from '@/components/features/restaurant-settings/businessContextDraftState';

const ALL_DIRTY = {
  businessDetails: true,
  categories: true,
  links: true,
  attributes: true,
  serviceItems: true,
  serviceAreas: true,
};

function drafts(over: Partial<BusinessContextDrafts>): BusinessContextDrafts {
  return { ...EMPTY_BUSINESS_CONTEXT_DRAFTS, ...over } as BusinessContextDrafts;
}

describe('collectDiscoveryIssues', () => {
  it('finds nothing in a valid draft', () => {
    expect(
      collectDiscoveryIssues(
        drafts({
          links: [makeLinkRow()],
          categories: [makeCategoryRow()],
          serviceAreas: [makeServiceAreaRow({ areaType: 'region' })],
          attributes: [makeAttributeRow({ valueType: 'boolean' })],
          serviceItems: [makeServiceItemRow()],
        } as Partial<BusinessContextDrafts>),
        ALL_DIRTY,
      ),
    ).toEqual([]);
  });

  it('restates the API rules next to the field, in page order', () => {
    const issues = collectDiscoveryIssues(
      drafts({
        categories: [
          makeCategoryRow({ id: 'category-a', displayName: ' ' }),
          makeCategoryRow({ id: 'category-b', isPrimary: true }),
        ],
        links: [makeLinkRow({ id: 'link-a', url: 'example.com' })],
        attributes: [
          makeAttributeRow({ id: 'attribute-a', valueType: 'boolean', rawValueJson: '[1]' }),
        ],
        serviceItems: [makeServiceItemRow({ id: 'service-item-a', itemKey: '' })],
        serviceAreas: [makeServiceAreaRow({ id: 'area-a', areaType: 'city' })],
      } as Partial<BusinessContextDrafts>),
      ALL_DIRTY,
    );

    expect(issues.map((issue) => [issue.family, issue.fieldId, issue.message])).toEqual([
      ['categories', 'categories-category-a-displayName', 'Every category needs a name.'],
      [
        'categories',
        'discovery-category-category-a-make-main',
        'Only one category can be the main one. Choose Make main on the one you want.',
      ],
      ['links', 'links-link-a-url', 'Enter a full web address, starting with https://'],
      [
        'attributes',
        'attributes-attribute-a-rawValueJson',
        'Raw value must be a valid JSON object.',
      ],
      [
        'serviceItems',
        'serviceItems-service-item-a-itemKey',
        'Enter a service code. Each service needs one.',
      ],
      [
        'serviceAreas',
        'serviceAreas-area-a-areaType',
        'Area type must be place, region, postal_code or other.',
      ],
    ]);
    // Fields inside collapsed areas name the disclosures "Show first issue" must open.
    expect(issues.find((issue) => issue.family === 'attributes')?.disclosures).toEqual([
      'discovery-amenities-raw',
      'discovery-attribute-attribute-a-payload',
    ]);
    expect(issues.find((issue) => issue.family === 'serviceItems')?.disclosures).toEqual([
      'discovery-service-service-item-a-advanced',
    ]);
    expect(countDiscoveryIssuesByFamily(issues)).toMatchObject({
      categories: 2,
      links: 1,
      businessDetails: 0,
    });
  });

  it('ignores sections without changes, because they are not sent', () => {
    const invalid = drafts({
      links: [makeLinkRow({ url: 'not a url' })],
    } as Partial<BusinessContextDrafts>);

    expect(collectDiscoveryIssues(invalid, EMPTY_DIRTY_STATE)).toEqual([]);
    expect(collectDiscoveryIssues(invalid, { ...EMPTY_DIRTY_STATE, links: true })).toHaveLength(1);
  });

  it('validates raw JSON the same way the payload builder parses it', () => {
    const issues = collectDiscoveryIssues(
      drafts({
        attributes: [
          makeAttributeRow({ valueType: 'boolean', valueMetadataJson: '{"not":"array"}' }),
        ],
        serviceAreas: [makeServiceAreaRow({ areaType: 'region', placeDataJson: '{bad' })],
      } as Partial<BusinessContextDrafts>),
      ALL_DIRTY,
    );

    expect(issues.map((issue) => issue.message)).toEqual([
      'Value details must be a valid JSON array.',
      'Place data must be a valid JSON object.',
    ]);
  });

  it('accepts the attribute value types and aliases the API accepts', () => {
    for (const valueType of ['boolean', 'BOOL', 'string', 'url', 'REPEATED_ENUM', 'enum']) {
      expect(isValidAttributeValueType(valueType)).toBe(true);
    }
    expect(isValidAttributeValueType('number')).toBe(false);
  });
});
