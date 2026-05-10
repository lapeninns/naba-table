import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main className="guest-theme pg-page" aria-busy="true">
      <section className="pg-section-tight">
        <div className="pg-container space-y-6">
          <div className="pg-panel space-y-4 p-5 sm:p-6">
            <Skeleton className="h-8 w-48 rounded-full" />
            <Skeleton className="h-12 w-full max-w-2xl" />
            <Skeleton className="h-5 w-full max-w-xl" />
            <Skeleton className="h-11 w-full max-w-lg rounded-full" />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={`restaurant-loading-card-${index}`} className="pg-panel overflow-hidden">
                <Skeleton className="aspect-[16/10] w-full rounded-none" />
                <div className="space-y-4 p-4 sm:p-5">
                  <Skeleton className="h-7 w-2/3" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-24 w-full rounded-[var(--pg-radius-md)]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
