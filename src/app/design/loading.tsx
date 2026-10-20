import { Skeleton } from "@/components/ui/skeleton";

// Shaped like the catalog: a title, then sections of swatches and cards. It holds no text: the
// messages follow the college's language setting, which a loading boundary renders without.
export default function Loading() {
  return (
    <main
      aria-busy
      className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-8"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </main>
  );
}
