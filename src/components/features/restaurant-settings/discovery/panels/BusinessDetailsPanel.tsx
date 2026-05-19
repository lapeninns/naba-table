'use client';

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

import { FamilyActions, FamilyError, FamilyStatus } from '../DiscoveryPanelChrome';
import { DiscoveryFamilyPanel } from './DiscoveryFamilyPanel';

import type { BusinessDetailsEditor, FamilyKey } from '../../businessContextModel';
import type { RestaurantBusinessContextEditor } from '../../useRestaurantBusinessContextEditor';

export function BusinessDetailsPanel({
  editor,
}: {
  embedded: boolean;
  editor: RestaurantBusinessContextEditor;
  family?: FamilyKey;
}) {
  return (
    <DiscoveryFamilyPanel>
      <FamilyStatus family="businessDetails" editor={editor} />

      <div className="space-y-4 rounded-xl border border-border/60 p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="business-details-opening-date">Opening date</Label>
            <Input
              id="business-details-opening-date"
              type="date"
              value={editor.businessDetails.openingDate}
              onChange={(event) => editor.updateBusinessDetails('openingDate', event.target.value)}
            />
            <p className="text-xs leading-5 text-muted-foreground">
              Optional public opening date for the venue.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="business-details-status">Business status</Label>
            <Select
              value={editor.businessDetails.businessStatus}
              onValueChange={(value) =>
                editor.updateBusinessDetails(
                  'businessStatus',
                  value as BusinessDetailsEditor['businessStatus'],
                )
              }
            >
              <SelectTrigger id="business-details-status" aria-label="Business status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unset">Unset</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed_temporarily">Closed temporarily</SelectItem>
                <SelectItem value="closed_permanently">Closed permanently</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs leading-5 text-muted-foreground">
              Optional public status for profile checks and listings.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 border-t border-border/60 pt-4">
          <Switch
            id="business-details-service-area-business"
            checked={editor.businessDetails.isServiceAreaBusiness}
            onCheckedChange={(checked) =>
              editor.updateBusinessDetails('isServiceAreaBusiness', checked)
            }
          />
          <div className="space-y-1">
            <Label htmlFor="business-details-service-area-business">Service-area business</Label>
            <p className="text-xs leading-5 text-muted-foreground">
              Mark this when the restaurant serves guests beyond the venue.
            </p>
          </div>
        </div>
      </div>

      <FamilyActions family="businessDetails" editor={editor} saveLabel="Save profile basics" />
      <FamilyError family="businessDetails" editor={editor} />
    </DiscoveryFamilyPanel>
  );
}
