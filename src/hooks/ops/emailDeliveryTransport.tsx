'use client';

import { createContext, useContext, type ReactNode } from 'react';

import {
  httpEmailDeliveryTransport,
  type EmailDeliveryTransport,
} from '@/services/ops/email-delivery';

const EmailDeliveryTransportContext = createContext<EmailDeliveryTransport>(
  httpEmailDeliveryTransport,
);

/**
 * Overrides the email-delivery mutation transport (the dev harness routes it through its mock
 * BookingService). Without a provider the hooks call the ops API directly.
 */
export function EmailDeliveryTransportProvider({
  transport,
  children,
}: {
  transport: EmailDeliveryTransport;
  children: ReactNode;
}) {
  return (
    <EmailDeliveryTransportContext.Provider value={transport}>
      {children}
    </EmailDeliveryTransportContext.Provider>
  );
}

export function useEmailDeliveryTransport(): EmailDeliveryTransport {
  return useContext(EmailDeliveryTransportContext);
}
