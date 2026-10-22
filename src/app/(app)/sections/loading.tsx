import { Skeleton } from "@/components/ui/skeleton";

// Shaped like the sections page: its header card, then a card for each section. It holds no text:
// a loading boundary renders without the college's messages.
export default function Loading() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border bg-card px-5 py-6 sm:px-7 sm:py-8">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>
      {[1, 2, 3].map((card) => (
        <div key={card} className="divide-y rounded-xl border bg-card">
          <div className="flex flex-col gap-2 px-5 py-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-56" />
          </div>
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
