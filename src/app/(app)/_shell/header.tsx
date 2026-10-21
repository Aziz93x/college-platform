import { useTranslations } from "next-intl";
import { AccountMenu } from "./account-menu.tsx";
import { SearchButton } from "./command-menu.tsx";

// The bar above every page: the college's short name on a phone, the search and the account menu.
// Step 12 adds the bell and Step 13 the term switcher (docs/PLAN.md, notes under each).
export function Header({
  collegeName,
  account,
}: {
  collegeName?: string;
  account: { name: string; email: string };
}) {
  const t = useTranslations("shell");
  const accountLabels = useTranslations("auth.account");
  return (
    <header className="raise-on-scroll sticky top-0 z-30 bg-background/80 backdrop-blur-md backdrop-saturate-150">
      <div className="flex h-16 items-center gap-3 px-4 lg:px-8">
        {collegeName ? (
          <p className="truncate font-medium lg:hidden">{collegeName}</p>
        ) : null}
        <div className="ms-auto lg:ms-0">
          <SearchButton
            label={t("search")}
            shortcuts={{ ctrl: t("shortcutCtrl"), meta: t("shortcutMeta") }}
          />
        </div>
        <AccountMenu
          name={account.name}
          email={account.email}
          labels={{
            open: accountLabels("open", { name: account.name }),
            changePassword: accountLabels("changePassword"),
            signOut: accountLabels("signOut"),
            close: accountLabels("close"),
          }}
          className="lg:ms-auto"
        />
      </div>
      <div
        aria-hidden
        className="h-px from-gradient-start via-gradient-end/70 to-transparent ltr:bg-linear-to-r rtl:bg-linear-to-l"
      />
    </header>
  );
}
