'use client';

import { Mail, MessageCircle, Phone } from 'lucide-react';
import { useMemo } from 'react';

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
    <Card className="border-border/50 bg-background shadow-sm ring-1 ring-border/5">
      <CardContent className="space-y-3 p-3">
        {!hasAnyContact ? (
          <div className="flex items-center gap-2 rounded-md bg-muted/50 p-2 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-muted-foreground/40" />
            No contact details provided
          </div>
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
