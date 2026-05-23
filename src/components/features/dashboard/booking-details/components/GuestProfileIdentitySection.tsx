import { Mail, MessageCircle, Phone } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { formatPhoneForTel } from '../utils';

import type { FlattenedTable } from '../utils';
import type { OpsTodayBooking } from '@/types/ops';

export interface GuestProfileIdentitySectionProps {
  booking: OpsTodayBooking;
  initials: string;
  isLate: boolean;
  whatsappHref: string | null;
  assignedTableRows: FlattenedTable[];
}

export function GuestProfileIdentitySection({
  booking,
  initials,
  isLate,
  whatsappHref,
  assignedTableRows,
}: GuestProfileIdentitySectionProps) {
  return (
    <section className="relative flex items-start gap-4">
      <div
        className={cn(
          'pointer-events-none absolute -top-2 -left-2 h-24 w-24 rounded-full opacity-30 blur-3xl',
          isLate ? 'bg-destructive' : 'bg-primary',
        )}
        aria-hidden
      />

      <div
        className={cn(
          'relative z-10 flex size-14 shrink-0 items-center justify-center rounded-2xl text-base font-extrabold tracking-wider uppercase shadow-lg ring-2',
          isLate
            ? 'bg-destructive/20 text-destructive ring-destructive/20'
            : 'bg-primary/15 text-primary ring-primary/20',
        )}
        aria-hidden
      >
        {initials}
      </div>

      <div className="relative z-10 min-w-0 flex-1 pt-0.5">
        <h2 className="truncate text-xl leading-tight font-extrabold tracking-tight text-foreground">
          {booking.customerName}
        </h2>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge
            variant="secondary"
            className="border-border/50 bg-muted/80 px-2 py-0.5 text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
          >
            Primary Guest
          </Badge>
          {isLate ? (
            <Badge
              variant="outline"
              className="border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-bold tracking-widest text-destructive uppercase"
            >
              Late
            </Badge>
          ) : null}
          {booking.requiresTableAssignment && assignedTableRows.length === 0 ? (
            <Badge
              variant="outline"
              className="border-border/40 bg-muted/40 px-2 py-0.5 text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
            >
              No table
            </Badge>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {booking.customerPhone ? (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-auto gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold"
            >
              <a href={`tel:${formatPhoneForTel(booking.customerPhone)}`}>
                <Phone data-icon="inline-start" className="text-primary" />
                {booking.customerPhone}
              </a>
            </Button>
          ) : null}
          {whatsappHref ? (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-auto gap-1.5 rounded-xl border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary"
            >
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                <MessageCircle data-icon="inline-start" />
                WhatsApp
              </a>
            </Button>
          ) : null}
          {booking.customerEmail ? (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-auto gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold"
            >
              <a href={`mailto:${booking.customerEmail}`}>
                <Mail data-icon="inline-start" className="text-primary" />
                Email
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
