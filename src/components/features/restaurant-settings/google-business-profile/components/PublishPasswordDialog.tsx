'use client';

import { useEffect, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type PublishPasswordDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  isPending?: boolean;
  errorMessage?: string | null;
  onConfirm: (password: string) => Promise<void> | void;
};

export function PublishPasswordDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  isPending = false,
  errorMessage,
  onConfirm,
}: PublishPasswordDialogProps) {
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!open) {
      setPassword('');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-4">
            <Label htmlFor="gbp-password-confirmation">Confirm with your login password</Label>
            <p className="text-xs text-muted-foreground">
              Your password is only used for this confirmation request and is never stored.
            </p>
            <Input
              id="gbp-password-confirmation"
              type="password"
              autoComplete="current-password"
              value={password}
              placeholder="Enter your password"
              disabled={isPending}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {errorMessage ? (
            <Alert variant="destructive">
              <AlertTitle>Action could not be completed</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isPending || password.trim().length === 0}
            onClick={() => void onConfirm(password.trim())}
          >
            {isPending ? 'Submitting…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
