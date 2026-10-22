import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AccountMenu } from "./account-menu.tsx";
import { SearchButton } from "./command-menu.tsx";

// The bar above every page: the college's short name on a phone, the search, the term switcher
// (Step 13), the bell and the account menu.
export function Header({
  collegeName,
  account,
  term,
  bell,
}: {
  collegeName?: string;
  account: { name: string; email: string };
  /** The term switcher, while the college has a term the viewer may see. */
  term?: ReactNode;
  bell: ReactNode;
}) {
  const t = useTranslations("shell");
  const accountLabels = useTranslations("auth.account");
  return (
    // Opaque, so nothing scrolled under it shows through (UX review 1). The college's name gives
    // way first in a narrow header; the controls keep their size.
    <header className="raise-on-scroll @container sticky top-0 z-30 bg-background">
      <div className="flex h-16 items-center gap-3 px-4 lg:px-8">
        {collegeName ? (
          <p className="min-w-0 flex-1 truncate font-medium @max-2xs:hidden lg:hidden">
            {collegeName}
          </p>
        ) : null}
        <div className="ms-auto shrink-0 lg:ms-0">
          <SearchButton
            label={t("search")}
            shortcuts={{ ctrl: t("shortcutCtrl"), meta: t("shortcutMeta") }}
          />
        </div>
        {term ? <div className="min-w-0 shrink lg:ms-auto">{term}</div> : null}
        <div className={term ? "shrink-0" : "shrink-0 lg:ms-auto"}>{bell}</div>
        <AccountMenu
          name={account.name}
          email={account.email}
          labels={{
            open: accountLabels("open", { name: account.name }),
            profile: accountLabels("profile"),
            changePassword: accountLabels("changePassword"),
            signOut: accountLabels("signOut"),
            close: accountLabels("close"),
          }}
        />
      </div>
      <div
        aria-hidden
        className="h-px from-gradient-start via-gradient-end/70 to-transparent ltr:bg-linear-to-r rtl:bg-linear-to-l"
      />
    </header>
  );
}
