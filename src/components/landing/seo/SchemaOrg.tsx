'use client';

import { useMemo } from 'react';

import { salesContact } from '@/config/sales-contact';
import { safeJsonForHtmlScript } from '@/lib/security/script-json';

export function SchemaOrg() {
  const schema = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          name: 'Nabatable',
          url: 'https://nabatable.com',
          logo: 'https://nabatable.com/logo.png',
          description:
            'The ultimate reservations and capacity growth system for modern food-led UK pubs.',
          contactPoint: {
            '@type': 'ContactPoint',
            telephone: salesContact.phone,
            email: salesContact.email,
            contactType: 'sales',
            areaServed: 'GB',
            availableLanguage: ['en'],
          },
          address: {
            '@type': 'PostalAddress',
            addressCountry: 'GB',
            addressRegion: 'Cambridgeshire',
          },
        },
        {
          '@type': 'Product',
          name: 'Nabatable Packed House Pub System',
          description:
            'Automated reservations, reminders, floor planning, and service capacity controls for food-led UK pubs.',
          category: 'Software',
          offers: {
            '@type': 'Offer',
            price: '299-899',
            priceCurrency: 'GBP',
            availability: 'https://schema.org/InStock',
            seller: {
              '@type': 'Organization',
              name: 'Nabatable',
            },
          },
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: '4.9',
            reviewCount: '124',
          },
        },
        {
          '@type': 'WebSite',
          name: 'Nabatable',
          url: 'https://nabatable.com',
          description: 'Fill tables, reduce no-shows, and run calmer food-led UK pub services.',
          potentialAction: {
            '@type': 'SearchAction',
            target: {
              '@type': 'EntryPoint',
              urlTemplate: 'https://nabatable.com/restaurants?q={search_term_string}',
            },
            'query-input': 'required name=search_term_string',
          },
        },
      ],
    }),
    [],
  );

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonForHtmlScript(schema) }}
    />
  );
}
