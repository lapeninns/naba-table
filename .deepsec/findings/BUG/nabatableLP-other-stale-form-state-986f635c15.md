# [BUG] Discarded new drink form data can reappear on the next new item

**File:** [`src/components/features/menu/DrinkItemSheet.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/menu/DrinkItemSheet.tsx#L85-L947) (lines 85, 86, 88, 89, 945, 947)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-stale-form-state`

## Finding

The sheet only reloads form state when the source key changes or the form is not dirty. For a dirty new item, `sourceKey` remains `new`; confirming discard closes the sheet without resetting `form`, `loadedSourceKeyRef`, or `baselineSnapshotRef`. Reopening a new drink can therefore show the previously discarded data and risk accidental duplicate or incorrect menu entries.

## Recommendation

Reset the form and baseline snapshot when discard is confirmed or when the sheet transitions from closed to open for a new item.
