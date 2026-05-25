import {
  OPS_CARD_CLASS,
  OPS_CARD_CONTENT_CLASS,
  OPS_CARD_HEADER_CLASS,
} from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type { OpsEmailAnalyticsTile } from '../opsEmailDeliveryAnalyticsDomain';

export type OpsEmailDeliveryAnalyticsTilesProps = {
  tiles: OpsEmailAnalyticsTile[];
};

export function OpsEmailDeliveryAnalyticsTiles({ tiles }: OpsEmailDeliveryAnalyticsTilesProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile) => (
        <OpsEmailDeliveryAnalyticsTile
          key={tile.key}
          label={tile.label}
          value={tile.value}
          hint={tile.hint}
          toneClass={tile.toneClass}
        />
      ))}
    </div>
  );
}

function OpsEmailDeliveryAnalyticsTile({ label, value, hint, toneClass }: OpsEmailAnalyticsTile) {
  return (
    <Card className={cn(OPS_CARD_CLASS, toneClass)}>
      <CardHeader className={OPS_CARD_HEADER_CLASS}>
        <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className={OPS_CARD_CONTENT_CLASS}>
        <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
        {hint ? <p className="mt-2 text-sm text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
