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
    <Card className="border-emerald-200/60 bg-success/10 shadow-sm">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
            <CreditCard className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
              Deposit
            </div>
            <div className="text-lg font-bold text-emerald-950">{depositLabel}</div>
          </div>
        </div>
        <Badge className="bg-emerald-700 text-white">
          <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden />
          Paid
        </Badge>
      </CardContent>
    </Card>
  );
}

export default GuestDepositCard;

