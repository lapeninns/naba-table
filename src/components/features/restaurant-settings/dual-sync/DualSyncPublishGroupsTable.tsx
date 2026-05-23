import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { DualSyncDirectionIcon } from './DualSyncDirectionIcon';
import { buildDualSyncPublishGroupTableRows } from './dualSyncPublishPreviewDomain';

import type { DualSyncPublishGroup } from '@/server/dual-sync/publish/types';

type DualSyncPublishGroupsTableProps = {
  groups: ReadonlyArray<DualSyncPublishGroup>;
};

export function DualSyncPublishGroupsTable({ groups }: DualSyncPublishGroupsTableProps) {
  if (groups.length === 0) return null;

  const rows = buildDualSyncPublishGroupTableRows(groups);

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Section</TableHead>
            <TableHead className="w-[112px]">Direction</TableHead>
            <TableHead className="w-[96px]">Risk</TableHead>
            <TableHead className="w-[144px]">Masks</TableHead>
            <TableHead className="w-[96px] text-right">Fields</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="text-xs">
              <TableCell>
                <div className="font-medium">{row.sectionLabel}</div>
                <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                  {row.writeGroup}
                </div>
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1 font-mono text-[10px]">
                  <DualSyncDirectionIcon iconKey={row.directionIconKey} className="size-3" />
                  {row.directionLabel}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant={row.riskVariant} className="font-mono text-[10px]">
                  {row.riskLevel}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-[10px]">{row.masksLabel}</TableCell>
              <TableCell className="text-right font-mono text-[10px]">{row.fieldCount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
