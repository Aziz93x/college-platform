import { Skeleton } from "@/components/ui/skeleton";

// Shaped like the readiness board: its header card, its summary, then the college's six rows and
// the departments' plans. It holds no text: a loading boundary renders without the college's
// messages.
export default function Loading() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border bg-card px-5 py-6 sm:px-7 sm:py-8">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>
      <Skeleton className="h-7 w-32 rounded-full" />
      {[
        ["term", "framework", "people", "rayat", "matched", "tasks"],
        ["first", "second", "third"],
      ].map((rows) => (
        <div key={rows[0]} className="divide-y rounded-xl border bg-card">
          <div className="px-5 py-4">
            <Skeleton className="h-6 w-24" />
          </div>
          {rows.map((row) => (
            <div key={row} className="flex flex-col gap-2 px-5 py-4">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
