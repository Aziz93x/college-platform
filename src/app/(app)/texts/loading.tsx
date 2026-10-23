import { Skeleton } from "@/components/ui/skeleton";

// Shaped like the texts page: its header card, the search and the list. It holds no text: a
// loading boundary renders without the college's messages.
export default function Loading() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border bg-card px-5 py-6 sm:px-7 sm:py-8">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>
      <Skeleton className="h-11 w-full rounded-lg sm:max-w-md" />
      <div className="flex flex-col divide-y rounded-xl border bg-card">
        {["first", "second", "third", "fourth"].map((row) => (
          <div
            key={row}
            className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5"
          >
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-5 w-full max-w-sm" />
            </div>
            <Skeleton className="h-10 w-24 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
