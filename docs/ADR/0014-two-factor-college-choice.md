# ADR-0014: Two-factor is the college's choice

- Status: accepted (2026-10-21: the owner chose "an admin setting, off by default")
- Date: 2026-10-21
- Source: the owner's request in the build session; docs/PLAN.md, the notes from ADR-0014 under Steps 6, 40 and 41 and in the go-live checklist
- Amends: ADR-0009, decision 5 ("Two-factor for admin powers")
- Amended by: lead review B (docs/reviews/lead-B.md, M2), decisions 3 and 4

## Context

ADR-0009 made two-factor a condition of holding certain keys: whoever holds a key that lets them act on other people's accounts or on the platform itself sets up TOTP before anything else, and the system role holds every such key. The owner asked for two-factor to be optional, turned on and off by the admin, with each person free to use it, and for an admin to be able to turn it off for someone who lost their phone.

## Decision

1. **A setting decides whether two-factor is required.** `auth.requireTwoFactor`, in the security group, edited with `settings.manage` and confirmed with the password (`reauth`), is off by default. While it is on, ADR-0009's rule holds: whoever holds a key that requires two-factor sets it up before anything else. While it is off, no one is sent to set it up.
2. **Anyone may turn it on or off for their own account.** The profile says whether two-factor guards the account and leads to the setup page, which takes the person back to the profile (since UX review 1 the chosen setup is inside the shell, at `/profile/two-factor`; `/two-factor/setup` serves the required one only); once it is on, the profile turns it off with the password typed again, which counts toward the lockout as at sign-in. While the setting is on, someone whose keys require it cannot turn it off. Turning it off removes the app's secret and the backup codes, so turning it on again starts from a new secret.
3. **An admin may turn it off for someone else.** On a person's page and behind their row, beside the temporary password and with the same key and reach (`accounts.resetPassword`, so a head helps only their own trainers; since lead review B, the key held across the college reaches no one with an administrative key, or a key across the college, that its holder lacks, so one switch on the grid no longer hands a vice-dean the admins' accounts), "turn off two-factor" asks for the admin's password when it is due. The person's sessions stay. While the setting is on and the person's keys require it, they set it up again at their next request.
4. **What a key's flag still means.** A key keeps saying whether it requires two-factor: it decides who must set it up while the setting is on, and which accounts are out of a head's reach (ADR-0009, Step 10), or out of a reach across the college whose holder lacks the key (lead review B).
5. **Accounts that have it keep it.** The setting changes no account: the admin and the heads of the demo college keep the two-factor they have, and still give a code when they sign in.
6. **The setup's last step sends the person on itself.** Turning two-factor on gives the session a new cookie (Better Auth), which the setup page drawn again in the action's answer does not carry, so the page used to send the person to sign in and on through `/`. The action now sends them on: to Today when the college required it of them, back to the profile when they chose it. That move is the router's, not the full page load of ADR-0009 #9; lead review A's proposal 11 keeps the rest.

## Consequences

- A new college's first admin signs in with the temporary password, replaces it and reaches Today, with two-factor offered on the profile. The stack's first-run test and `pnpm admin:create`'s guide follow.
- The security review (Step 40) weighs the default against ASVS level 2, which asks for multi-factor on administrative interfaces; turning the setting on is one change on the settings screen, and the go-live checklist asks for it or for the owner's written choice.
- The audit log names one new event, `account.disableTwoFactor`, written with the person as actor when they turn it off and with the admin when an admin does; setting it up keeps `account.startTwoFactorSetup` and `account.enableTwoFactor`.
