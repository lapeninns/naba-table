import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { buildDualSyncOperationGroupViewModels } from './dualSyncPublishJobDetailDomain';

import type { DualSyncPublishOperationGroup } from '@/server/dual-sync';

export interface DualSyncPublishOperationGroupsTableProps {
  readonly groups: ReadonlyArray<DualSyncPublishOperationGroup>;
}

export function DualSyncPublishOperationGroupsTable({
  groups,
}: DualSyncPublishOperationGroupsTableProps) {
  if (groups.length === 0) return null;

  const rows = buildDualSyncOperationGroupViewModels(groups);

  return (
    <div className="rounded-md border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Group</TableHead>
            <TableHead>Write group</TableHead>
            <TableHead className="w-[100px]">Preflight</TableHead>
            <TableHead className="w-[90px] text-right">Fields</TableHead>
            <TableHead className="w-[130px]">Masks</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((group) => (
            <TableRow key={group.id} className="text-xs">
              <TableCell>
                <Badge variant={group.statusVariant} className="font-mono text-[10px]">
                  {group.status}
                </Badge>
                {group.errorCode ? (
                  <div className="mt-1 font-mono text-[10px] text-destructive">
                    {group.errorCode}
                  </div>
                ) : null}
              </TableCell>
              <TableCell>
                <div className="font-mono text-[10px]">{group.writeGroup}</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">{group.sectionLabel}</div>
              </TableCell>
              <TableCell className="font-mono text-[10px]">{group.preflightLabel}</TableCell>
              <TableCell className="text-right font-mono text-[10px]">
                {group.decisionCount}
              </TableCell>
              <TableCell className="font-mono text-[10px]">{group.masksLabel}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
