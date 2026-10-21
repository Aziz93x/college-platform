"use client";

import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/motion/breadcrumb";

export type Crumb = { label: string; href?: string };

// Where a page below another sits: the pages above it, outermost first, then the page itself. Kept
// mounted from one page to the next, so a trail that changes slides its new pages in.
export function PageTrail({
  crumbs,
  current,
  label,
}: {
  crumbs: Crumb[];
  current: string;
  label: string;
}) {
  return (
    <Breadcrumb aria-label={label} className="mb-3">
      <BreadcrumbList className="-ms-2">
        {crumbs.map((crumb, index) => (
          <BreadcrumbItem key={crumb.href ?? crumb.label}>
            {index > 0 ? <BreadcrumbSeparator /> : null}
            {crumb.href ? (
              <BreadcrumbLink
                href={crumb.href}
                render={({ href = "", ...props }) => (
                  <Link href={href} {...props} />
                )}
              >
                {crumb.label}
              </BreadcrumbLink>
            ) : (
              <span className="px-2 text-muted-foreground">{crumb.label}</span>
            )}
          </BreadcrumbItem>
        ))}
        <BreadcrumbItem key={`current:${current}`}>
          <BreadcrumbSeparator />
          <BreadcrumbPage>{current}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
