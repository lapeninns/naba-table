'use client';

import { Mail, MessageSquare } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

import { EmailDeliveryPanel } from './EmailDeliveryPanel';
import { SmsDeliveryPanel } from './SmsDeliveryPanel';

export type BookingDeliveryPanelProps = {
  bookingId: string;
  timezone: string;
  enabled?: boolean;
};

function ChannelHeader({
  icon: Icon,
  label,
}: {
  icon: typeof Mail;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-3.5 text-muted-foreground/60" aria-hidden />
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
        {label}
      </span>
    </div>
  );
}

export function BookingDeliveryPanel({
  bookingId,
  timezone,
  enabled = true,
}: BookingDeliveryPanelProps) {
  return (
    <Card className="border-border/50 bg-background shadow-sm ring-1 ring-border/5">
      <CardContent className="flex flex-col gap-0 p-0">
        <section className="flex flex-col gap-2 px-3 py-3" aria-label="Email delivery">
          <ChannelHeader icon={Mail} label="Email" />
          <EmailDeliveryPanel
            bookingId={bookingId}
            timezone={timezone}
            enabled={enabled}
            embedded
          />
        </section>

        <Separator className="bg-border/40" />

        <section className="flex flex-col gap-2 px-3 py-3" aria-label="Message delivery">
          <ChannelHeader icon={MessageSquare} label="Messages" />
          <SmsDeliveryPanel bookingId={bookingId} timezone={timezone} enabled={enabled} embedded />
        </section>
      </CardContent>
    </Card>
  );
}

export default BookingDeliveryPanel;
