'use client';

import { CheckCircle2, CreditCard } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export type GuestDepositCardProps = {
  depositLabel: string | null;
};

export function GuestDepositCard({ depositLabel }: GuestDepositCardProps) {
  if (!depositLabel) return null;

  return (
    <Card className="border-primary/30 bg-success/10 shadow-sm">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-sm">
            <CreditCard className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-primary">
              Deposit
            </div>
            <div className="truncate text-lg font-bold text-primary" title={depositLabel}>
              {depositLabel}
            </div>
          </div>
        </div>
        <Badge className="w-fit bg-primary/10 text-primary">
          <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden />
          Paid
        </Badge>
      </CardContent>
    </Card>
  );
}

export default GuestDepositCard;
