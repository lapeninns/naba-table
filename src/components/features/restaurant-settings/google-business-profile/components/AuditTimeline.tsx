'use client';

import { AlertTriangle, Clock3, History } from 'lucide-react';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { formatGbpDateTime } from '../lib/formatters';
import { formatAuditFlowLabel, workflowStatusVariant } from '../lib/sync-review';

import type { GoogleBusinessProfileWorkflow } from '@/services/ops/restaurants';

type AuditTimelineProps = {
  events: GoogleBusinessProfileWorkflow['auditEvents'];
};

export function AuditTimeline({ events }: AuditTimelineProps) {
  const renderEvent = (event: GoogleBusinessProfileWorkflow['auditEvents'][number]) => {
    const errors = Array.isArray(event.errors) ? event.errors : [];
    const masks = Array.isArray(event.googleUpdateMasks) ? event.googleUpdateMasks : [];

    return (
      <div key={event.id} className="rounded-lg border border-border/70 bg-background p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={workflowStatusVariant(event.result)}>{event.result}</Badge>
              <Badge variant="outline">{formatAuditFlowLabel(event)}</Badge>
              {event.affectedSections.length > 0 ? (
                <Badge variant="secondary">{event.affectedSections.join(', ')}</Badge>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Clock3 className="size-3.5" />
              <span>{formatGbpDateTime(event.createdAt) ?? event.createdAt}</span>
            </div>
          </div>
          {masks.length > 0 ? (
            <div className="text-xs text-muted-foreground">Google fields: {masks.join(', ')}</div>
          ) : null}
        </div>

        {errors.length > 0 ? (
          <div className="mt-3 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <div className="mb-1 flex items-center gap-2 font-medium">
              <AlertTriangle className="size-4" />
              Errors
            </div>
            <div className="space-y-1">
              {errors.map((error, index) => (
                <p key={`${event.id}-error-${index}`}>{JSON.stringify(error)}</p>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <Card className="border-border/70">
      <CardHeader className="border-b bg-muted/20">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Change history</CardTitle>
          <Badge variant="outline">{events.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {events.length > 0 ? (
          <Accordion type="single" collapsible>
            <AccordionItem value="all-changes" className="rounded-lg border border-border/70 px-4">
              <AccordionTrigger className="text-sm font-medium hover:no-underline">
                View changes ({events.length})
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-1">{events.map(renderEvent)}</div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        ) : (
          <div className="flex min-h-[160px] flex-col items-center justify-center gap-3 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted/50">
              <History className="size-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">No changes applied yet</p>
              <p className="text-xs text-muted-foreground">
                Completed updates will appear here after the first reviewed change is applied.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
