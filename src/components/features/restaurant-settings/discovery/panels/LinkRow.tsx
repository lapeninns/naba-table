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

import { getLinkRemoveLabel, LINK_TEXT_FIELDS } from './linksPanelDomain';
import { LINK_TYPE_OPTIONS, makeFieldId, type LinkEditor } from '../../businessContextModel';
import { DiscoveryFieldError, useDiscoveryField } from '../DiscoveryFormContext';

import type { RestaurantBusinessContextEditor } from '../../useRestaurantBusinessContextEditor';

type LinkRowEditor = Pick<RestaurantBusinessContextEditor, 'updateLink'>;

function LinkTextField({
  row,
  editor,
  spec,
}: {
  row: LinkEditor;
  editor: LinkRowEditor;
  spec: (typeof LINK_TEXT_FIELDS)[number];
}) {
  const fieldId = makeFieldId('links', row.id, spec.field);
  const { issue, fieldProps } = useDiscoveryField(fieldId);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label htmlFor={fieldId}>{spec.label}</Label>
      <Input
        {...fieldProps}
        type={'type' in spec ? spec.type : undefined}
        inputMode={'inputMode' in spec ? spec.inputMode : undefined}
        value={row[spec.field]}
        placeholder={spec.placeholder}
        className={
          spec.field === 'url'
            ? 'font-mono [@media(pointer:coarse)]:min-h-11'
            : '[@media(pointer:coarse)]:min-h-11'
        }
        onChange={(event) => editor.updateLink(row.id, spec.field, event.target.value)}
      />
      <DiscoveryFieldError fieldId={fieldId} issue={issue} />
    </div>
  );
}

/** One link: type, web address, label, Main switch and remove. */
export function LinkRow({
  row,
  editor,
  onRemove,
}: {
  row: LinkEditor;
  editor: LinkRowEditor;
  onRemove: () => void;
}) {
  const typeFieldId = makeFieldId('links', row.id, 'linkType');
  const typeField = useDiscoveryField(typeFieldId);
  const urlSpec = LINK_TEXT_FIELDS.find((spec) => spec.field === 'url');
  const labelSpec = LINK_TEXT_FIELDS.find((spec) => spec.field === 'label');
  const primaryId = makeFieldId('links', row.id, 'isPrimary');

  return (
    <div className="grid min-w-0 gap-3 rounded-lg border border-border/60 p-3 md:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_minmax(0,9rem)_auto] md:items-start">
      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor={typeFieldId}>Type</Label>
        <Select
          value={row.linkType}
          onValueChange={(value) => editor.updateLink(row.id, 'linkType', value)}
        >
          <SelectTrigger
            id={typeFieldId}
            aria-invalid={typeField.fieldProps['aria-invalid']}
            aria-describedby={typeField.fieldProps['aria-describedby']}
            className="w-full [@media(pointer:coarse)]:min-h-11"
          >
            <SelectValue placeholder="Choose a type" />
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
        <DiscoveryFieldError fieldId={typeFieldId} issue={typeField.issue} />
      </div>
      {urlSpec ? <LinkTextField row={row} editor={editor} spec={urlSpec} /> : null}
      {labelSpec ? <LinkTextField row={row} editor={editor} spec={labelSpec} /> : null}
      <div className="flex items-center justify-between gap-2 md:mt-7 md:justify-start">
        <div className="flex items-center gap-2">
          <Switch
            id={primaryId}
            checked={row.isPrimary}
            onCheckedChange={(checked) => editor.updateLink(row.id, 'isPrimary', checked)}
          />
          <Label htmlFor={primaryId}>Main</Label>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${getLinkRemoveLabel(row)}`}
          className="text-muted-foreground hover:text-destructive [@media(pointer:coarse)]:size-11"
          onClick={onRemove}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
