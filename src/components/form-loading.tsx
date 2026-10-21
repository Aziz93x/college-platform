import { Skeleton } from "@/components/ui/skeleton";

// Shaped like a page under a list (a department, a role): its trail and header, then a form's
// sections. It holds no text: a loading boundary renders without the college's messages.
export function FormLoading() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border bg-card px-5 py-6 sm:px-7 sm:py-8">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>
      <div className="divide-y rounded-xl border bg-card">
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-6">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
        <div className="flex flex-col gap-3 px-5 py-5 sm:px-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-11 w-full lg:max-w-xl" />
        </div>
        <div className="flex justify-end px-5 py-4 sm:px-6">
          <Skeleton className="h-10 w-28 rounded-full" />
        </div>
      </div>
    </div>
  );
}
