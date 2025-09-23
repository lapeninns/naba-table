export default function TripsPage() {
  const items: any[] = [];
  return (
    <main className="mx-auto max-w-[393px] px-[var(--screen-margin)] py-4">
      <h1 className="text-screen-title">Trips</h1>
      {items.length === 0 ? (
        <div className="empty-state">
          <p className="text-section-header">No trips yet</p>
          <p className="mt-2 text-body text-[color:var(--color-text-secondary)]">When you book, your itinerary appears here.</p>
        </div>
      ) : (
        <div className="grid gap-4">{/* map trips here */}</div>
      )}
    </main>
  );
}

