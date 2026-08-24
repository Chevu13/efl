import { Skeleton, SkeletonRows } from '@/components/ui/primitives';

/**
 * Skelet stranice.
 *
 * Oblik odgovara onome sto stize — naslov, traka brojeva, lista — pa
 * prelaz na pravi sadrzaj ne pomera raspored.
 */
export default function Loading() {
  return (
    <div className="page py-10" aria-busy>
      <span className="sr-only" role="status">
        Ucitavanje…
      </span>

      <Skeleton className="h-3 w-32" />
      <Skeleton className="mt-4 h-9 w-2/3 max-w-md" />
      <Skeleton className="mt-3 h-4 w-full max-w-xl" />

      <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface px-4 py-3.5">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="mt-2.5 h-6 w-12" />
          </div>
        ))}
      </div>

      <div className="mt-8">
        <SkeletonRows rows={7} />
      </div>
    </div>
  );
}
