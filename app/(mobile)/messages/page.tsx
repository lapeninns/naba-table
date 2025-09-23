export default function MessagesPage() {
  return (
    <main className="mx-auto max-w-[393px] px-[var(--screen-margin)] py-4">
      <h1 className="text-screen-title">Messages</h1>
      <div className="mt-4 grid gap-3">
        {[1, 2, 3].map((i) => (
          <button
            key={i}
            className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 text-left focus-visible"
          >
            <div>
              <p className="text-card-title">Host {i}</p>
              <p className="text-label">Tap to view conversation</p>
            </div>
            <span aria-hidden className="text-label">›</span>
          </button>
        ))}
      </div>
    </main>
  );
}

