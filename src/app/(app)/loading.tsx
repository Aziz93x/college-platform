import { Skeleton } from "@/components/ui/skeleton";

// Shaped like a page in the shell: its header card, then a block of content. It holds no text: the
// messages follow the college's language setting, which a loading boundary renders without.
export default function Loading() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border bg-card px-5 py-6 sm:px-7 sm:py-8">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
