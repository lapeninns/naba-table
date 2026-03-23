'use client';

import { useMemo } from 'react';

import { salesContact } from '@/config/sales-contact';

export function SchemaOrg() {
  const schema = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          name: 'Nab a Table',
          url: 'https://nabatable.com',
          logo: 'https://nabatable.com/logo.png',
          description:
            'The operating system for modern hospitality. Empowering venues to deliver exceptional guest experiences through data and automation.',
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
          name: 'Nab a Table Booking System',
          description:
            'Automated table reservation system for UK pubs and restaurants. Eliminate no-shows, increase revenue, and streamline operations.',
          category: 'Software',
          offers: {
            '@type': 'Offer',
            price: '299-899',
            priceCurrency: 'GBP',
            availability: 'https://schema.org/InStock',
            seller: {
              '@type': 'Organization',
              name: 'Nab a Table',
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
          name: 'Nab a Table',
          url: 'https://nabatable.com',
          description:
            'Reserve your table in 30 seconds across Cambridgeshire, Norfolk and Bedfordshire.',
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
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
