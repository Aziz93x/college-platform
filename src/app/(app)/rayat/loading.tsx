import { Skeleton } from "@/components/ui/skeleton";

// Shaped like the Rayat page: its header card, then a card for each report. It holds no text: a
// loading boundary renders without the college's messages.
export default function Loading() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border bg-card px-5 py-6 sm:px-7 sm:py-8">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>
      {["ss01", "sf01", "so01"].map((report) => (
        <div key={report} className="divide-y rounded-xl border bg-card">
          <div className="flex flex-col gap-2 px-5 py-4">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-full max-w-sm" />
          </div>
          <div className="px-5 py-4">
            <Skeleton className="h-28 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
