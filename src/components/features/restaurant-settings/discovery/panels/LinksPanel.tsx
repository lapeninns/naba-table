'use client';

import { Plus } from 'lucide-react';
import { memo } from 'react';

import { Button } from '@/components/ui/button';

import { LinkRow } from './LinkRow';
import { makeFieldId } from '../../businessContextModel';
import { SettingsCardEmptyState } from '../../shared/SettingsCardEmptyState';
import { useDiscoveryForm } from '../DiscoveryFormContext';
import { DISCOVERY_FIELD_IDS } from '../discoveryValidation';

import type { RestaurantBusinessContextEditor } from '../../useRestaurantBusinessContextEditor';

export type LinksPanelEditor = Pick<
  RestaurantBusinessContextEditor,
  'links' | 'addLink' | 'updateLink' | 'removeLink'
>;

/** Section 3: website and social links. */
export const LinksPanel = memo(function LinksPanel({ editor }: { editor: LinksPanelEditor }) {
  const { requestFocus } = useDiscoveryForm();

  return (
    <>
      {editor.links.length > 0 ? (
        <div className="flex flex-col gap-2">
          {editor.links.map((row) => (
            <LinkRow
              key={row.id}
              row={row}
              editor={editor}
              onRemove={() => {
                editor.removeLink(row.id);
                requestFocus(DISCOVERY_FIELD_IDS.addLink);
              }}
            />
          ))}
        </div>
      ) : (
        <SettingsCardEmptyState
          title="No links yet"
          description="Add your website or social profiles below."
        />
      )}
      <div>
        <Button
          type="button"
          variant="outline"
          id={DISCOVERY_FIELD_IDS.addLink}
          onClick={() => requestFocus(makeFieldId('links', editor.addLink(), 'linkType'))}
        >
          <Plus data-icon="inline-start" aria-hidden />
          Add link
        </Button>
      </div>
    </>
  );
});
