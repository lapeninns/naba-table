'use client';

import { QrCode } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

import type { Reservation } from '@entities/reservation/reservation.schema';

export function QRCodeDialogLazy({ reservation, children }: { reservation: Reservation; children: React.ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">Check-in Code</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center py-8">
          <div className="rounded-2xl border-2 border-slate-100 bg-white p-6 shadow-inner">
            <QrCode className="h-48 w-48 text-slate-900" />
          </div>
          <div className="mt-6 text-center">
            <p className="font-mono text-3xl font-bold tracking-widest text-slate-900">
              {reservation.id.slice(0, 8).toUpperCase()}
            </p>
            <p className="mt-2 text-slate-500">Show this code to the host on arrival</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default QRCodeDialogLazy;
