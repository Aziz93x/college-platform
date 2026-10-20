import { cn } from "@/components/ui/cn";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-shimmer rounded-md bg-[length:200%_100%] bg-muted bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--background)_55%,transparent),transparent)] bg-no-repeat ltr:[animation-direction:reverse]",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
