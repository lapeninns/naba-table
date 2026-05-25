export function DualSyncFieldBlockedReasons({ reasons }: { readonly reasons: readonly string[] }) {
  if (reasons.length === 0) {
    return null;
  }

  return (
    <ul className="text-muted-foreground flex flex-col gap-0.5 text-[11px]">
      {reasons.map((reason) => (
        <li key={reason}>· {reason}</li>
      ))}
    </ul>
  );
}
