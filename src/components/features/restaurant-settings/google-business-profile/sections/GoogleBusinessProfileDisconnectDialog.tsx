'use client';

import { useEffect, useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type GoogleBusinessProfileDisconnectDialogProps = {
  open: boolean;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (password: string) => void;
};

export function GoogleBusinessProfileDisconnectDialog({
  open,
  isPending,
  onOpenChange,
  onConfirm,
}: GoogleBusinessProfileDisconnectDialogProps) {
  const [password, setPassword] = useState('');
  const trimmedPassword = password.trim();

  useEffect(() => {
    if (!open) {
      setPassword('');
    }
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="gbp-disconnect-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect Google Business Profile?</AlertDialogTitle>
          <AlertDialogDescription>
            Nabatable stops comparing with and publishing to this Google listing. Your Google
            listing and Nabatable settings stay as they are.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="gbp-disconnect-password">Confirm with your password</Label>
          <Input
            id="gbp-disconnect-password"
            type="password"
            autoComplete="current-password"
            value={password}
            disabled={isPending}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: 'destructive' })}
            disabled={isPending || trimmedPassword.length === 0}
            onClick={(event) => {
              event.preventDefault();
              onConfirm(trimmedPassword);
            }}
          >
            {isPending ? 'Disconnecting…' : 'Disconnect'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default GoogleBusinessProfileDisconnectDialog;
