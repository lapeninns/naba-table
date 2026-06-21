'use client';

import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

import { getLinkRemoveLabel, getLinkRowTitle, LINK_TEXT_FIELDS } from './linksPanelDomain';
import { LINK_TYPE_OPTIONS, makeFieldId, type LinkEditor } from '../../businessContextModel';

import type { RestaurantBusinessContextEditor } from '../../useRestaurantBusinessContextEditor';

export function LinkRow({
  row,
  editor,
}: {
  row: LinkEditor;
  editor: RestaurantBusinessContextEditor;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{getLinkRowTitle(row)}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${getLinkRemoveLabel(row)}`}
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
              <SelectGroup>
                {LINK_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        {LINK_TEXT_FIELDS.slice(0, 1).map(({ label, field, placeholder }) => (
          <div key={field} className="space-y-2">
            <Label htmlFor={makeFieldId('links', row.id, field)}>{label}</Label>
            <Input
              id={makeFieldId('links', row.id, field)}
              value={row[field]}
              placeholder={placeholder}
              onChange={(event) => editor.updateLink(row.id, field, event.target.value)}
            />
          </div>
        ))}
        <div className="flex items-start gap-3 pt-8">
          <Switch
            id={makeFieldId('links', row.id, 'isPrimary')}
            checked={row.isPrimary}
            onCheckedChange={(checked) => editor.updateLink(row.id, 'isPrimary', checked)}
          />
          <Label htmlFor={makeFieldId('links', row.id, 'isPrimary')}>Primary</Label>
        </div>
      </div>
      {LINK_TEXT_FIELDS.slice(1).map(({ label, field, placeholder, inputMode, type }) => (
        <div key={field} className="space-y-2">
          <Label htmlFor={makeFieldId('links', row.id, field)}>{label}</Label>
          <Input
            id={makeFieldId('links', row.id, field)}
            type={type}
            inputMode={inputMode}
            value={row[field]}
            placeholder={placeholder}
            onChange={(event) => editor.updateLink(row.id, field, event.target.value)}
          />
        </div>
      ))}
    </div>
  );
}
