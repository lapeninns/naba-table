'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

import { ClickToCopy } from '../ClickToCopy';

export type GuestNotesCardProps = {
  bookingNotes: string | null;
  profileNotes: string | null;
};

export function GuestNotesCard({ bookingNotes, profileNotes }: GuestNotesCardProps) {
  if (!bookingNotes && !profileNotes) return null;

  return (
    <Card className="border-border/50 bg-background shadow-sm ring-1 ring-border/5">
      <CardContent className="p-0">
        <Accordion type="single" collapsible className="w-full">
          {bookingNotes ? (
            <AccordionItem value="notes" className="border-none px-3">
              <AccordionTrigger className="py-2.5 hover:no-underline">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                    Booking Notes
                  </span>
                  <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-bold">
                    1
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-3 pt-0">
                <div className="space-y-2">
                  <div className="rounded-md border border-border/50 bg-muted/30 p-2.5 text-xs leading-relaxed text-foreground">
                    {bookingNotes}
                  </div>
                  <ClickToCopy text={bookingNotes} label="notes" compact />
                </div>
              </AccordionContent>
            </AccordionItem>
          ) : null}

          {profileNotes ? (
            <AccordionItem value="profile" className="border-none px-3">
              <AccordionTrigger className="py-2.5 hover:no-underline">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                  Profile History
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-3 pt-0">
                <div className="rounded-md border border-border/50 bg-muted/30 p-2.5 text-xs leading-relaxed text-foreground">
                  {profileNotes}
                </div>
              </AccordionContent>
            </AccordionItem>
          ) : null}
        </Accordion>
      </CardContent>
    </Card>
  );
}

export default GuestNotesCard;
