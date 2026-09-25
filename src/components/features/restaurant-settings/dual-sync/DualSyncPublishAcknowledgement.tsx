import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

type DualSyncPublishAcknowledgementProps = {
  acknowledged: boolean;
  onAcknowledgedChange: (acknowledged: boolean) => void;
  purpose?: 'publish' | 'import';
};

export function DualSyncPublishAcknowledgement({
  acknowledged,
  onAcknowledgedChange,
  purpose = 'publish',
}: DualSyncPublishAcknowledgementProps) {
  return (
    <div className="flex items-start gap-2 rounded-md border p-3">
      <Checkbox
        id="dual-sync-preview-acknowledgement"
        checked={acknowledged}
        onCheckedChange={(value) => onAcknowledgedChange(value === true)}
      />
      <Label htmlFor="dual-sync-preview-acknowledgement" className="block text-sm leading-5">
        {purpose === 'import'
          ? 'I understand these Nabatable values will be replaced with Google’s.'
          : 'I understand this may update public Google Business Profile data.'}
      </Label>
    </div>
  );
}
