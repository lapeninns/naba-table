'use client';

import { Mail, MessageCircle, Phone } from 'lucide-react';
import { useMemo } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';

import { formatPhoneForTel } from '../../utils';
import { ContactInfoRow } from '../ContactInfoRow';

import type { OpsTodayBooking } from '@/types/ops';

export type GuestContactCardProps = {
  booking: OpsTodayBooking;
};

export function GuestContactCard({ booking }: GuestContactCardProps) {
  const whatsappHref = useMemo(() => {
    const digits = booking.customerPhone ? booking.customerPhone.replace(/[^0-9]/g, '') : '';
    return digits ? `https://wa.me/${digits}` : null;
  }, [booking.customerPhone]);

  const hasAnyContact = Boolean(booking.customerPhone || booking.customerEmail);

  return (
    <Card className="border-slate-200/60 bg-white">
      <CardContent className="space-y-2 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Contact
        </div>

        {!hasAnyContact ? (
          <Alert className="bg-muted/30">
            <AlertTitle>No contact details</AlertTitle>
            <AlertDescription>
              This booking does not include a phone number or email address.
            </AlertDescription>
          </Alert>
        ) : null}

        {booking.customerPhone ? (
          <ContactInfoRow
            icon={Phone}
            label="Phone"
            value={booking.customerPhone}
            href={`tel:${formatPhoneForTel(booking.customerPhone)}`}
            actions={
              whatsappHref
                ? [
                    {
                      label: 'WhatsApp',
                      href: whatsappHref,
                      icon: MessageCircle,
                    },
                  ]
                : undefined
            }
          />
        ) : null}

        {booking.customerEmail ? (
          <ContactInfoRow
            icon={Mail}
            label="Email"
            value={booking.customerEmail}
            href={`mailto:${booking.customerEmail}`}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

export default GuestContactCard;

