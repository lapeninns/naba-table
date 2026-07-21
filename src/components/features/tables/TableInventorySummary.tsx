import { Text } from '@/components/ui/typography';

export function SummaryCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string | number;
  description?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <Text variant="caption">{label}</Text>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      {description ? <Text variant="caption" className="mt-1">{description}</Text> : null}
    </div>
  );
}
