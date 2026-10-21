import { IdentityArt } from "@/components/identity-art";
import type { NavigationGroup, ShellLink } from "./navigation.ts";
import { SidebarFrame } from "./sidebar-frame.tsx";
import { SidebarNav } from "./sidebar-nav.tsx";

// The desktop sidebar: a dark identity surface with the platform's and the college's names, the
// page links under their groups, and the identity curves rising from its foot in a glow of the
// gradient's end color. On its icon rail, the names fold away and the gradient's bar stays.
export function Sidebar({
  open,
  platformName,
  collegeName,
  links,
  groups,
  labels,
}: {
  open: boolean;
  platformName: string;
  collegeName?: string;
  links: ShellLink[];
  groups: Record<NavigationGroup, string>;
  labels: { navigation: string; collapse: string; expand: string };
}) {
  return (
    <SidebarFrame open={open} labels={labels}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_55%_at_50%_105%,color-mix(in_srgb,var(--gradient-end)_45%,transparent),transparent_70%)]"
      />
      <IdentityArt
        element="curves"
        sizes="408px"
        className="absolute -bottom-8 start-0 h-auto w-[150%] max-w-none opacity-45 mix-blend-screen rtl:-scale-x-100"
      />
      {/* On the rail, the names fold away under the toggle and the gradient's bar moves below it. */}
      <div className="relative px-6 pt-8 pb-7 transition-[padding] duration-300 group-data-[state=collapsed]/sidebar:pt-20">
        {/* The names keep the open width, so they fold away without wrapping again. */}
        <div className="grid grid-rows-[1fr] transition-[grid-template-rows,opacity] duration-300 group-data-[state=collapsed]/sidebar:grid-rows-[0fr] group-data-[state=collapsed]/sidebar:opacity-0">
          <div className="min-h-0 w-56 overflow-hidden pe-10">
            <p className="text-balance font-medium text-lg leading-snug">
              {platformName}
            </p>
            {collegeName ? (
              <p className="mt-1 text-foreground/70 text-sm leading-snug">
                {collegeName}
              </p>
            ) : null}
          </div>
        </div>
        <span
          aria-hidden
          className="mt-3 block h-1 w-10 rounded-full from-gradient-end to-primary transition-[width,margin] duration-300 group-data-[state=collapsed]/sidebar:mt-0 group-data-[state=collapsed]/sidebar:w-5 ltr:bg-linear-to-r rtl:bg-linear-to-l"
        />
      </div>
      <SidebarNav links={links} groups={groups} label={labels.navigation} />
    </SidebarFrame>
  );
}
