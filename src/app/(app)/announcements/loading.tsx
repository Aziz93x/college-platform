import { Skeleton } from "@/components/ui/skeleton";

// Shaped like the announcements page: its header, the form's card, then a few announcements. It
// holds no text: a loading boundary renders without the college's messages.
export default function Loading() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border bg-card px-5 py-6 sm:px-7 sm:py-8">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>
      <div className="flex flex-col gap-4 rounded-xl border bg-card px-5 py-5 sm:px-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-10 w-36 self-end rounded-full" />
      </div>
      <div className="divide-y rounded-xl border bg-card">
        {["first", "second"].map((row) => (
          <div key={row} className="flex flex-col gap-2 px-5 py-4">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-full max-w-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
