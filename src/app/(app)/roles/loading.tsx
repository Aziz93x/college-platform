import { Skeleton } from "@/components/ui/skeleton";

// Shaped like the roles list: its header card, then a table of roles. It holds no text: a loading
// boundary renders without the college's messages.
export default function Loading() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border bg-card px-5 py-6 sm:px-7 sm:py-8">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>
      <div className="divide-y rounded-xl border bg-card">
        <Skeleton className="h-12 rounded-none rounded-t-xl" />
        {["first", "second", "third", "fourth"].map((row) => (
          <div
            key={row}
            className="flex items-center justify-between gap-4 px-4 py-3"
          >
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
