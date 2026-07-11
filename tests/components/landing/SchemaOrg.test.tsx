import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SchemaOrg } from '@/components/landing/seo/SchemaOrg';

type SchemaGraph = {
  '@context': string;
  '@graph': Array<Record<string, unknown>>;
};

function renderSchema(): SchemaGraph {
  const { container } = render(<SchemaOrg />);
  const script = container.querySelector('script[type="application/ld+json"]');
  expect(script).not.toBeNull();
  return JSON.parse(script?.innerHTML ?? 'null') as SchemaGraph;
}

describe('SchemaOrg', () => {
  it('@contract emits valid JSON-LD with organization, product, and website nodes', () => {
    const schema = renderSchema();

    expect(schema['@context']).toBe('https://schema.org');
    const types = schema['@graph'].map((node) => node['@type']);
    expect(types).toEqual(['Organization', 'Product', 'WebSite']);
  });

  it('@contract describes Nabatable with GBP pricing and GB targeting', () => {
    const schema = renderSchema();
    const [organization, product, website] = schema['@graph'];

    expect(organization.name).toBe('Nabatable');
    expect(organization.url).toBe('https://nabatable.com');
    expect((organization.contactPoint as { areaServed: string }).areaServed).toBe('GB');
    expect((product.offers as { priceCurrency: string }).priceCurrency).toBe('GBP');
    expect(website.name).toBe('Nabatable');
  });

  it('@contract escapes angle brackets so the payload cannot break out of the script tag', () => {
    const { container } = render(<SchemaOrg />);
    const raw = container.querySelector('script[type="application/ld+json"]')?.innerHTML ?? '';

    expect(raw).not.toContain('<');
    expect(raw).not.toContain('>');
  });
});
