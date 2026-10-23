import { Skeleton } from "@/components/ui/skeleton";

// Shaped like the plan page: its header card, the plan's card with its weeks, then a few items. It
// holds no text: a loading boundary renders without the college's messages.
export default function Loading() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border bg-card px-5 py-6 sm:px-7 sm:py-8">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>
      <div className="divide-y rounded-xl border bg-card">
        <div className="flex flex-col gap-2 px-5 py-5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 rounded-none" />
        {["first", "second", "third", "fourth"].map((row) => (
          <div key={row} className="flex flex-col gap-2 px-4 py-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-48" />
          </div>
        ))}
      </div>
    </div>
  );
}
