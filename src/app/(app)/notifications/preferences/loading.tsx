import { Skeleton } from "@/components/ui/skeleton";

// Shaped like the preferences: their trail and header, then the card of kinds, each a row with its
// switch (Audit 4). It holds no text: a loading boundary renders without the college's messages.
export default function Loading() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border bg-card px-5 py-6 sm:px-7 sm:py-8">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>
      <div className="rounded-xl border bg-card">
        <div className="border-b px-5 py-4 sm:px-6">
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="divide-y">
          {["first", "second", "third"].map((row) => (
            <div
              key={row}
              className="flex items-center gap-4 px-5 py-4 sm:px-6"
            >
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-5 w-48 max-w-full" />
                <Skeleton className="h-4 w-full max-w-sm" />
              </div>
              <Skeleton className="h-7 w-12 shrink-0 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
