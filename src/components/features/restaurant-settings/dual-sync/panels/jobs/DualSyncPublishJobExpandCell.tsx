import { ChevronDown, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { TableCell } from '@/components/ui/table';

interface DualSyncPublishJobExpandCellProps {
  readonly isSelected: boolean;
  readonly onToggle: () => void;
}

export function DualSyncPublishJobExpandCell({
  isSelected,
  onToggle,
}: DualSyncPublishJobExpandCellProps) {
  const Icon = isSelected ? ChevronDown : ChevronRight;

  return (
    <TableCell className="w-[28px] align-top">
      <Button
        variant="ghost"
        size="icon-sm"
        className="size-6"
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        aria-label={isSelected ? 'Hide job detail' : 'Show job detail'}
      >
        <Icon data-icon="inline-start" />
      </Button>
    </TableCell>
  );
}
