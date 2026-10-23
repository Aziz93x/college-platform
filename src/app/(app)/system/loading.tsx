import { Skeleton } from "@/components/ui/skeleton";

// Shaped like the system page: its header card, the checks, the passes and the sessions. It holds
// no text: a loading boundary renders without the college's messages.
export default function Loading() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border bg-card px-5 py-6 sm:px-7 sm:py-8">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>
      {["checks", "passes"].map((part) => (
        <div
          key={part}
          className="flex flex-col gap-3 rounded-xl border bg-card px-5 py-5"
        >
          <Skeleton className="h-6 w-36" />
          {["first", "second", "third"].map((row) => (
            <div key={row} className="flex items-center justify-between gap-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          ))}
        </div>
      ))}
      <div className="flex flex-col gap-3 rounded-xl border bg-card px-5 py-5">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-10 w-36 rounded-full" />
      </div>
    </div>
  );
}
