'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { DIALOG_SHORTCUTS, KEYBOARD_SHORTCUTS } from '../constants';
import { ShortcutHint } from './ShortcutHint';

import type { KeyboardShortcutsDialogProps } from '../types';

/**
 * Dialog displaying available keyboard shortcuts
 * Single Responsibility: Display keyboard shortcuts help
 */
export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Use these keys to manage the booking without leaving the keyboard.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {KEYBOARD_SHORTCUTS.map((shortcut) => (
            <ShortcutHint
              key={shortcut.key}
              keys={shortcut.keys}
              description={shortcut.description}
            />
          ))}
          <ShortcutHint
            keys={DIALOG_SHORTCUTS.close.keys}
            description={DIALOG_SHORTCUTS.close.description}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
