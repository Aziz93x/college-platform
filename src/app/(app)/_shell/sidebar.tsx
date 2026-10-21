import { IdentityArt } from "@/components/identity-art";
import type { ShellLink } from "./navigation.ts";
import { SidebarNav } from "./sidebar-nav.tsx";

// The desktop sidebar: a dark identity surface with the platform's and the college's names, the
// page links, and the identity curves rising from its foot in a glow of the gradient's end color.
export function Sidebar({
  platformName,
  collegeName,
  links,
  label,
}: {
  platformName: string;
  collegeName?: string;
  links: ShellLink[];
  label: string;
}) {
  return (
    <aside className="dark sticky top-0 hidden h-dvh w-68 shrink-0 flex-col overflow-hidden bg-background text-foreground lg:flex">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_55%_at_50%_105%,color-mix(in_srgb,var(--gradient-end)_45%,transparent),transparent_70%)]"
      />
      <IdentityArt
        element="curves"
        sizes="408px"
        className="absolute -bottom-8 start-0 h-auto w-[150%] max-w-none opacity-45 mix-blend-screen rtl:-scale-x-100"
      />
      <div className="relative px-6 pt-8 pb-7">
        <p className="text-balance font-medium text-lg leading-snug">
          {platformName}
        </p>
        {collegeName ? (
          <p className="mt-1 text-foreground/70 text-sm leading-snug">
            {collegeName}
          </p>
        ) : null}
        <span
          aria-hidden
          className="mt-3 block h-1 w-10 rounded-full from-gradient-end to-primary ltr:bg-linear-to-r rtl:bg-linear-to-l"
        />
      </div>
      <SidebarNav links={links} label={label} />
    </aside>
  );
}
