import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from 'nabatable-platform';

export const BookingPolicies = () => (
  <Accordion type="single" defaultValue="cancellation" collapsible className="w-80 rounded-lg border">
    <AccordionItem value="cancellation">
      <AccordionTrigger>Cancellation policy</AccordionTrigger>
      <AccordionContent className="text-muted-foreground">
        Cancel up to 24 hours before your booking with no charge. No-shows are
        charged £10 per cover.
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="party">
      <AccordionTrigger>Large party requests</AccordionTrigger>
      <AccordionContent className="text-muted-foreground">
        Parties of 8 or more require a deposit and a 2-hour turn time.
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="access">
      <AccordionTrigger>Accessibility &amp; high chairs</AccordionTrigger>
      <AccordionContent className="text-muted-foreground">
        Step-free access throughout. High chairs available on request.
      </AccordionContent>
    </AccordionItem>
  </Accordion>
);

export const TableDetails = () => (
  <Accordion type="single" defaultValue="t12" className="w-80 rounded-lg border">
    <AccordionItem value="t12">
      <AccordionTrigger>Table T12 · 8:00 PM</AccordionTrigger>
      <AccordionContent className="space-y-1 text-muted-foreground">
        <p>Priya Nair · Party of 4 · Confirmed</p>
        <p>Window booth · Anniversary</p>
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="t1">
      <AccordionTrigger>Table T1 · 8:15 PM</AccordionTrigger>
      <AccordionContent className="text-muted-foreground">
        Tom Hill · Party of 2 · Walk-in · Seated
      </AccordionContent>
    </AccordionItem>
  </Accordion>
);
