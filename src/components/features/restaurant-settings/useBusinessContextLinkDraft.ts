import { useState } from 'react';

import { createLinkEditor, removeEditorRow, updateEditorRow } from './businessContextEditorActions';

import type { LinkEditor } from './businessContextModel';

type UseBusinessContextLinkDraftOptions = {
  onDirty: () => void;
};

export function useBusinessContextLinkDraft({ onDirty }: UseBusinessContextLinkDraftOptions) {
  const [links, setLinks] = useState<LinkEditor[]>([]);

  const addLink = () => {
    setLinks((current) => [...current, createLinkEditor()]);
    onDirty();
  };

  const updateLink = <Key extends keyof LinkEditor>(
    rowId: string,
    field: Key,
    value: LinkEditor[Key],
  ) => {
    setLinks((current) => updateEditorRow(current, rowId, field, value));
    onDirty();
  };

  const removeLink = (rowId: string) => {
    setLinks((current) => removeEditorRow(current, rowId));
    onDirty();
  };

  return {
    links,
    setLinks,
    addLink,
    updateLink,
    removeLink,
  };
}
