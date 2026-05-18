'use client';

import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

import { LINK_TYPE_OPTIONS, makeFieldId, type FamilyKey } from '../../businessContextModel';
import { FamilyActions, FamilyError, FamilyStatus } from '../DiscoveryPanelChrome';
import { DiscoveryFamilyPanel } from './DiscoveryFamilyPanel';

import type { RestaurantBusinessContextEditor } from '../../useRestaurantBusinessContextEditor';

export function LinksPanel({
  editor,
}: {
  embedded: boolean;
  editor: RestaurantBusinessContextEditor;
  family?: FamilyKey;
}) {
  return (
    <DiscoveryFamilyPanel>
      <FamilyStatus family="links" editor={editor} />

      {editor.links.map((row) => (
        <div key={row.id} className="flex flex-col gap-3 rounded-lg border border-border/60 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {row.label ||
                  LINK_TYPE_OPTIONS.find((option) => option.value === row.linkType)?.label ||
                  'New link'}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${row.label || row.linkType || 'link'}`}
              title="Remove link"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => editor.removeLink(row.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor={makeFieldId('links', row.id, 'linkType')}>Link type</Label>
              <Select
                value={row.linkType}
                onValueChange={(value) => editor.updateLink(row.id, 'linkType', value)}
              >
                <SelectTrigger id={makeFieldId('links', row.id, 'linkType')} aria-label="Link type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LINK_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={makeFieldId('links', row.id, 'label')}>Label</Label>
              <Input
                id={makeFieldId('links', row.id, 'label')}
                value={row.label}
                placeholder="Website"
                onChange={(event) => editor.updateLink(row.id, 'label', event.target.value)}
              />
            </div>
            <div className="flex items-start gap-3 pt-8">
              <Switch
                id={makeFieldId('links', row.id, 'isPrimary')}
                checked={row.isPrimary}
                onCheckedChange={(checked) => editor.updateLink(row.id, 'isPrimary', checked)}
              />
              <Label htmlFor={makeFieldId('links', row.id, 'isPrimary')}>Primary</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={makeFieldId('links', row.id, 'url')}>URL</Label>
            <Input
              id={makeFieldId('links', row.id, 'url')}
              type="url"
              inputMode="url"
              value={row.url}
              placeholder="https://example.com"
              onChange={(event) => editor.updateLink(row.id, 'url', event.target.value)}
            />
          </div>
        </div>
      ))}

      <FamilyActions family="links" editor={editor} saveLabel="Save links">
        <Button type="button" variant="outline" onClick={editor.addLink}>
          <Plus className="size-4" />
          Add link
        </Button>
      </FamilyActions>
      <FamilyError family="links" editor={editor} />
    </DiscoveryFamilyPanel>
  );
}
