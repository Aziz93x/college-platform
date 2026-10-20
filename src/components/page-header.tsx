import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { IdentityArt } from "@/components/identity-art";

type Crumb = { label: string; href?: string };

// The top of every page in the shell: where the page sits, its title, what it is for and its
// actions. The identity gradient runs along its top edge and the identity wave along its foot.
export function PageHeader({
  eyebrow,
  title,
  description,
  breadcrumbs,
  breadcrumbsLabel,
  actions,
}: {
  /** A short line above the title, such as the greeting and the date. */
  eyebrow?: string;
  title: string;
  description?: string;
  /** The pages above this one, outermost first. A top-level page has none. */
  breadcrumbs?: Crumb[];
  /** The accessible name of the breadcrumb trail; required with breadcrumbs. */
  breadcrumbsLabel?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="relative isolate mb-6 overflow-hidden rounded-xl border bg-card px-5 py-6 shadow-sm sm:px-7 sm:pt-8 sm:pb-16">
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-0.5 from-gradient-start via-gradient-end to-transparent ltr:bg-linear-to-r rtl:bg-linear-to-l"
      />
      <IdentityArt
        element="wave"
        sizes="(min-width: 1024px) 960px, 100vw"
        // A band at the card's foot, below the text, fading out upward. Not on a phone, where it
        // would be the page's largest paint and hold it back (docs/PLAN.md section 4, LCP).
        className="absolute inset-x-0 bottom-0 -z-10 hidden h-14 w-full object-cover object-bottom [mask-image:linear-gradient(to_top,black_30%,transparent)] sm:block rtl:-scale-x-100"
      />
      {breadcrumbs?.length ? (
        <nav aria-label={breadcrumbsLabel} className="mb-3">
          <ol className="flex flex-wrap items-center gap-1 text-muted-foreground text-sm">
            {breadcrumbs.map((crumb) => (
              <li key={crumb.label} className="flex items-center gap-1">
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="rounded-sm transition-colors hover:text-foreground"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span>{crumb.label}</span>
                )}
                <ChevronLeft aria-hidden className="size-4 ltr:rotate-180" />
              </li>
            ))}
            <li aria-current="page" className="text-foreground">
              {title}
            </li>
          </ol>
        </nav>
      ) : null}
      {eyebrow ? (
        <p className="fade-in mb-2 flex animate-in items-center gap-2 text-muted-foreground text-sm duration-500">
          <span aria-hidden className="size-1.5 rounded-full bg-gradient-end" />
          {eyebrow}
        </p>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl">{title}</h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
