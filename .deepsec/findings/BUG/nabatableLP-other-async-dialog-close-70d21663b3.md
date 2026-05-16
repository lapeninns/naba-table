# [BUG] Async confirmation closes before the action finishes

**File:** [`src/components/features/booking-state-machine/ConfirmationDialog.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/booking-state-machine/ConfirmationDialog.tsx#L79-L103) (lines 79, 83, 84, 86, 103)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-async-dialog-close`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The confirm button is rendered as AlertDialogAction, which Radix implements as DialogPrimitive.Close. handleConfirm is async but does not receive the click event or call preventDefault, so Radix closes the dialog immediately after the click while onConfirm is still pending. handleOpenChange can run onAfterClose before the mutation completes, and handleConfirm calls onAfterClose again after await. In the no-show and undo-no-show call sites this can clear the reason field and close the destructive confirmation even if the mutation later fails.

## Recommendation

Handle the click event explicitly, call event.preventDefault(), await onConfirm, and close the dialog only after a successful confirmation. Centralize the close path so onAfterClose fires once.

## Revalidation

**Verdict:** fixed

`src/components/features/booking-state-machine/ConfirmationDialog.tsx` now prevents the Radix `AlertDialogAction` default close behavior, blocks external close while a confirmation is submitting, and closes through one explicit success path after `onConfirm` resolves. Failed confirmations keep the dialog open and do not run `onAfterClose`. `tests/components/ConfirmationDialog.test.tsx` covers both the pending-success path and the failed-confirmation path.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-17)
