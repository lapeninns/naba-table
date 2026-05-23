import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { OpsEmailAnalyticsFailureSection } from '../opsEmailDeliveryAnalyticsDomain';

export type OpsEmailDeliveryAnalyticsFailureSectionProps = {
  section: OpsEmailAnalyticsFailureSection;
};

export function OpsEmailDeliveryAnalyticsFailureSection({
  section,
}: OpsEmailDeliveryAnalyticsFailureSectionProps) {
  return (
    <Card className="border-border bg-background shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-foreground">{section.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {section.entries.length > 0 ? (
          section.entries.map((entry) => (
            <div
              key={entry.key}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2"
            >
              <span className="truncate text-sm text-foreground" title={entry.label}>
                {entry.label}
              </span>
              <Badge variant="secondary">{entry.count}</Badge>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">{section.emptyLabel}</p>
        )}
      </CardContent>
    </Card>
  );
}
