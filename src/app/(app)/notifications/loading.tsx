import { Skeleton } from "@/components/ui/skeleton";

// Shaped like the notification center: its header card, then a day of notifications. It holds no
// text: a loading boundary renders without the college's messages.
export default function Loading() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border bg-card px-5 py-6 sm:px-7 sm:py-8">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-5 w-full max-w-lg" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-40" />
        <div className="divide-y rounded-xl border bg-card">
          {["first", "second", "third"].map((row) => (
            <div key={row} className="flex gap-3 px-4 py-3 sm:px-5">
              <Skeleton className="size-8 shrink-0 rounded-lg" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-5 w-64 max-w-full" />
                <Skeleton className="h-4 w-48 max-w-full" />
              </div>
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
