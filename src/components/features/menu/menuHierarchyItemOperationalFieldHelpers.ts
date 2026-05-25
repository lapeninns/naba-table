import type { ItemFormState } from './menuHierarchyDomain';
import type { Dispatch, SetStateAction } from 'react';

export type ItemStateSetter = Dispatch<SetStateAction<ItemFormState>>;

export function patchItemState(setState: ItemStateSetter, update: Partial<ItemFormState>) {
  setState((current) => ({ ...current, ...update }));
}
