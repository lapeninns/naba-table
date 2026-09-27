'use client';

import { useEffect, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { ConfirmDialog } from '../../ConfirmDialog';

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
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="destructive"
      title="Disconnect Google Business Profile?"
      description="Nabatable stops comparing with and publishing to this Google listing. Your Google listing and Nabatable settings stay as they are."
      confirmLabel="Disconnect"
      pending={isPending}
      pendingLabel="Disconnecting…"
      confirmDisabled={trimmedPassword.length === 0}
      // The caller closes the dialog once the disconnect settles.
      keepOpenOnConfirm
      onConfirm={() => onConfirm(trimmedPassword)}
    >
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
    </ConfirmDialog>
  );
}

export default GoogleBusinessProfileDisconnectDialog;
