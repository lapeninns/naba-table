const workerBoundaryConfigs = [
  {
    files: ['cloudflare/booking-short-links/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../../email-queue-gateway/**', '../../sms-summary-gateway/**'],
              message:
                'Booking short-links must not depend on another deployable Worker. Move shared contracts to cloudflare/shared.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['cloudflare/email-queue-gateway/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../../booking-short-links/**', '../../sms-summary-gateway/**'],
              message:
                'Email queue gateway must not depend on another deployable Worker. Move shared contracts to cloudflare/shared.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['cloudflare/sms-summary-gateway/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../../booking-short-links/**', '../../email-queue-gateway/**'],
              message:
                'SMS summary gateway must not depend on another deployable Worker. Move shared contracts to cloudflare/shared.',
            },
          ],
        },
      ],
    },
  },
];

export default workerBoundaryConfigs;
