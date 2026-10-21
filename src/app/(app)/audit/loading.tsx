import { Skeleton } from "@/components/ui/skeleton";

// Shaped like the log: its header card, the filters, then a day of events. It holds no text: a
// loading boundary renders without the college's messages.
export default function Loading() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border bg-card px-5 py-6 sm:px-7 sm:py-8">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-full max-w-lg" />
      </div>
      <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
        {["period", "action", "person"].map((field) => (
          <div key={field} className="flex flex-col gap-1.5">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        ))}
        <Skeleton className="h-11 w-20 self-end" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-40" />
        <div className="divide-y rounded-xl border bg-card">
          {["first", "second", "third", "fourth"].map((row) => (
            <div key={row} className="flex gap-3 px-4 py-3 sm:px-5">
              <Skeleton className="size-8 shrink-0 rounded-lg" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-5 w-56 max-w-full" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
