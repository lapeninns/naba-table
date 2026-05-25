import { Download } from 'lucide-react';
import { type ReactNode } from 'react';

import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';

import type { DualSyncLazyPanelState } from './dualSyncLazyPanelsDomain';

interface DualSyncLazyPanelItemProps {
  readonly children: ReactNode;
  readonly panel: DualSyncLazyPanelState;
  readonly onActivate: () => void;
}

export function DualSyncLazyPanelItem({ children, panel, onActivate }: DualSyncLazyPanelItemProps) {
  return (
    <AccordionItem
      value={panel.value}
      className="border-b"
      onClick={() => {
        if (!panel.isActive) onActivate();
      }}
    >
      <AccordionTrigger className="text-sm font-semibold" onClick={onActivate}>
        {panel.title}
      </AccordionTrigger>
      <AccordionContent className="pt-2">
        {panel.isActive ? (
          children
        ) : (
          <DualSyncLazyPanelPlaceholder panel={panel} onLoad={onActivate} />
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

function DualSyncLazyPanelPlaceholder({
  panel,
  onLoad,
}: {
  readonly panel: DualSyncLazyPanelState;
  readonly onLoad: () => void;
}) {
  if (!panel.loadButtonLabel) {
    return <div className="text-xs text-muted-foreground">{panel.inactiveDescription}</div>;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed p-3">
      <span className="text-xs text-muted-foreground">{panel.inactiveDescription}</span>
      <Button type="button" variant="outline" size="sm" onClick={onLoad}>
        <Download data-icon="inline-start" aria-hidden />
        {panel.loadButtonLabel}
      </Button>
    </div>
  );
}
