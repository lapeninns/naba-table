import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main className="bg-muted/40" aria-busy="true">
      <section className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:px-8 sm:py-14 lg:px-10">
        <div className="space-y-4 rounded-[2rem] border border-border/50 bg-background/90 p-6 shadow-sm">
          <Skeleton className="h-10 w-64 sm:w-80" />
          <Skeleton className="h-5 w-full max-w-2xl" />
          <Skeleton className="h-12 w-full max-w-xl rounded-xl" />
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`restaurant-loading-card-${index}`}
              className="space-y-4 rounded-[1.75rem] border border-border/50 bg-background/95 p-5 shadow-sm"
            >
              <Skeleton className="h-44 w-full rounded-[1.25rem]" />
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-10 w-32 rounded-xl" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
