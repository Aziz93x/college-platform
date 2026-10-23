import { Skeleton } from "@/components/ui/skeleton";

// Shaped like the console: its header card, what needs attention, the college at a glance and the
// tiles of the administration's pages. It holds no text: a loading boundary renders without the
// college's messages.
export default function Loading() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border bg-card px-5 py-6 sm:px-7 sm:py-8">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>
      <div className="flex flex-col gap-3 rounded-xl border bg-card px-5 py-5">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-5 w-full max-w-sm" />
        <Skeleton className="h-5 w-full max-w-xs" />
      </div>
      <div className="grid gap-4 rounded-xl border bg-card px-5 py-5 sm:grid-cols-3">
        {["people", "departments", "roles"].map((part) => (
          <div key={part} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {["first", "second", "third"].map((tile) => (
          <Skeleton key={tile} className="h-24 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
