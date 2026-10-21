import { Skeleton } from "@/components/ui/skeleton";

// Shaped like the settings screen: its header card, the search and the group tabs, then a card of
// setting rows. It holds no text: a loading boundary renders without the college's messages.
export default function Loading() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border bg-card px-5 py-6 sm:px-7 sm:py-8">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>
      <div className="flex flex-col gap-3 lg:flex-row-reverse lg:justify-between">
        <Skeleton className="h-11 w-full rounded-lg lg:w-80" />
        <Skeleton className="h-12 w-full max-w-xl rounded-full" />
      </div>
      <div className="divide-y rounded-xl border bg-card">
        {["first", "second", "third", "fourth"].map((row) => (
          <div
            key={row}
            className="flex flex-col gap-3 px-5 py-5 sm:px-6 lg:flex-row lg:justify-between"
          >
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-full max-w-sm" />
            </div>
            <Skeleton className="h-11 w-full rounded-lg lg:w-64" />
          </div>
        ))}
      </div>
    </div>
  );
}
