'use client';

import { createContext, useContext, type ReactNode } from 'react';

import {
  httpEmailTemplatesTransport,
  type EmailTemplatesTransport,
} from '@/services/ops/email-templates';

const EmailTemplatesTransportContext = createContext<EmailTemplatesTransport>(
  httpEmailTemplatesTransport,
);

/**
 * Overrides the email-template preview/test-send transport (the dev harness routes it through
 * its mock RestaurantService). Without a provider the hooks call the ops API directly.
 */
export function EmailTemplatesTransportProvider({
  transport,
  children,
}: {
  transport: EmailTemplatesTransport;
  children: ReactNode;
}) {
  return (
    <EmailTemplatesTransportContext.Provider value={transport}>
      {children}
    </EmailTemplatesTransportContext.Provider>
  );
}

export function useEmailTemplatesTransport(): EmailTemplatesTransport {
  return useContext(EmailTemplatesTransportContext);
}
