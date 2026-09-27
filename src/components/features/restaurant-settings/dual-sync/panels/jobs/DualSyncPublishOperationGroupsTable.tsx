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
import { SettingsOverflowFrame } from '../../../shared/SettingsOverflowFrame';

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
    <SettingsOverflowFrame className="overflow-hidden rounded-md border bg-background">
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
                <Badge variant={group.statusVariant} className="font-mono text-xs">
                  {group.status}
                </Badge>
                {group.errorCode ? (
                  <div className="mt-1 font-mono text-xs text-destructive">{group.errorCode}</div>
                ) : null}
              </TableCell>
              <TableCell>
                <div className="font-mono text-xs">{group.writeGroup}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{group.sectionLabel}</div>
              </TableCell>
              <TableCell className="font-mono text-xs">{group.preflightLabel}</TableCell>
              <TableCell className="text-right font-mono text-xs">{group.decisionCount}</TableCell>
              <TableCell className="font-mono text-xs">{group.masksLabel}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SettingsOverflowFrame>
  );
}
