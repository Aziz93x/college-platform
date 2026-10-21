import { Skeleton } from "@/components/ui/skeleton";

// Shaped like the sign-in form in the card: its title and line, two fields and the button. It holds
// no text: the messages follow the college's language setting, which a loading boundary renders
// without.
export default function Loading() {
  return (
    <div aria-busy className="flex flex-col">
      <Skeleton className="h-7 w-32" />
      <Skeleton className="mt-2 h-5 w-full max-w-56" />
      <div className="mt-6 flex flex-col gap-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-11 rounded-lg" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-11 rounded-lg" />
        <Skeleton className="mt-16 h-11 rounded-lg" />
      </div>
    </div>
  );
}
