import { Skeleton } from "@/components/ui/skeleton";

// Shaped like the requests page: its header card with the send button, then the term's requests.
// It holds no text: a loading boundary renders without the college's messages.
export default function Loading() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border bg-card px-5 py-6 sm:px-7 sm:py-8">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-5 w-full max-w-md" />
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="divide-y rounded-xl border bg-card">
        <div className="px-5 py-4">
          <Skeleton className="h-6 w-28" />
        </div>
        {[1, 2, 3].map((row) => (
          <div key={row} className="flex flex-col gap-2 px-5 py-4">
            <Skeleton className="h-5 w-56 max-w-full" />
            <Skeleton className="h-4 w-72 max-w-full" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}
