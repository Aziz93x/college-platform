"use client";

import { KeyRound, LogOut, UserRound } from "lucide-react";
import { useTransition } from "react";
import { signOutAction } from "@/app/(auth)/actions";
import { BloomMenu } from "@/components/motion/bloom-menu";
import { Loader } from "@/components/motion/loader";
import { initials } from "./initials.ts";

type Labels = {
  open: string;
  profile: string;
  changePassword: string;
  signOut: string;
  close: string;
};

// The person's initials in the header, opening into their name, email, their profile and account
// actions.
export function AccountMenu({
  name,
  email,
  labels,
  className,
}: {
  name: string;
  email: string;
  labels: Labels;
  className?: string;
}) {
  const [signingOut, startSignOut] = useTransition();
  return (
    <BloomMenu
      triggerLabel={labels.open}
      trigger={
        <span
          aria-hidden
          className="grid size-full place-items-center rounded-full bg-linear-to-br from-gradient-start to-gradient-end p-0.5"
        >
          <span className="grid size-full place-items-center rounded-full bg-primary font-medium text-primary-foreground text-sm">
            {initials(name)}
          </span>
        </span>
      }
      heading={
        <>
          <p className="truncate font-medium">{name}</p>
          <p className="truncate text-muted-foreground text-xs">
            <bdi>{email}</bdi>
          </p>
        </>
      }
      items={[
        {
          id: "profile",
          label: labels.profile,
          icon: <UserRound />,
          href: "/profile",
        },
        {
          id: "change-password",
          label: labels.changePassword,
          icon: <KeyRound />,
          href: "/profile/password",
        },
        {
          id: "sign-out",
          label: labels.signOut,
          icon: <LogOut className="rtl:-scale-x-100" />,
          busy: signingOut,
          busyIcon: <Loader size={20} />,
          // The login page loads from scratch, so nothing of this person's pages stays in the
          // browser's memory or the router's cache.
          onSelect: () =>
            startSignOut(async () => {
              const result = await signOutAction();
              if (!result?.serverError) window.location.replace("/");
            }),
        },
      ]}
      closeLabel={labels.close}
      className={className}
    />
  );
}
