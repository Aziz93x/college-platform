"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { getViewer, publicAction, signedInAction } from "@/modules/access";
import {
  changePassword,
  confirmTwoFactorSetup,
  signIn,
  signOut,
  startTwoFactorSetup,
  verifySignInCode,
} from "@/modules/identity";
import { getSetting } from "@/modules/settings";
import {
  checkboxField,
  formFields,
  latinDigits,
} from "@/platform/validation/form";

// The forms on the sign-in pages post here, before their JavaScript has loaded as well as after.
// Signing in and its second step are open to anyone; the rest needs a session, even one that still
// has a password to replace or two-factor to set up. Each service writes its own audit event. The
// forms load the next page from scratch themselves (useLeaveTo), so nothing typed or shown here
// stays in the browser's memory; the last step of two-factor's setup sends the person on itself
// (below).

// Better Auth's longest password; a longer field is refused before it is hashed. Its digits are read
// as Latin, as in every field, so a password set on an Arabic keyboard works on a Latin one.
const password = latinDigits(z.string().min(1).max(128));

export const signInAction = publicAction
  .metadata({ name: "signIn" })
  .inputSchema(
    formFields(
      z.object({
        identifier: z.string().trim().min(1).max(254),
        password,
        remember: checkboxField,
      }),
    ),
  )
  .stateAction(async ({ parsedInput }) => signIn(parsedInput, await headers()));

export const verifyCodeAction = publicAction
  .metadata({ name: "verifySignInCode" })
  .inputSchema(
    formFields(
      z.object({
        code: latinDigits(z.string().trim().min(1).max(32)),
        backup: checkboxField,
      }),
    ),
  )
  .stateAction(async ({ parsedInput }) =>
    verifySignInCode(parsedInput, await headers()),
  );

export const startTwoFactorSetupAction = signedInAction
  .metadata({ name: "startTwoFactorSetup" })
  .inputSchema(formFields(z.object({ password })))
  .stateAction(async ({ parsedInput, ctx: { user } }) => {
    // Authenticator apps list the account under the platform's name.
    const issuer =
      (await getSetting("platform.name", { collegeId: user.collegeId })) ??
      (await getTranslations("platform"))("name");
    return startTwoFactorSetup(
      { password: parsedInput.password, issuer },
      user,
      await headers(),
    );
  });

export const confirmTwoFactorSetupAction = signedInAction
  .metadata({ name: "confirmTwoFactorSetup" })
  .inputSchema(
    formFields(
      z.object({ code: latinDigits(z.string().trim().min(1).max(16)) }),
    ),
  )
  .stateAction(async ({ parsedInput, ctx: { user } }) => {
    // Whoever the college required it of goes on to Today; whoever chose it, back to the profile.
    const required = (await getViewer())?.needsTwoFactorSetup ?? false;
    const result = await confirmTwoFactorSetup(
      parsedInput.code,
      user,
      await headers(),
    );
    // Turning it on gives the session a new cookie, which the setup page drawn again in this
    // answer would not carry: it would send the person to sign in. The next page carries it.
    if (result.status === "enabled") redirect(required ? "/today" : "/profile");
    return result;
  });

export const changePasswordAction = signedInAction
  .metadata({ name: "changePassword" })
  .inputSchema(
    formFields(
      z
        .object({
          currentPassword: password,
          newPassword: password,
          confirmPassword: latinDigits(z.string().max(128)),
        })
        .refine((input) => input.newPassword === input.confirmPassword, {
          path: ["confirmPassword"],
        }),
    ),
  )
  .stateAction(async ({ parsedInput, ctx: { user } }) =>
    changePassword(parsedInput, user, await headers()),
  );

export const signOutAction = signedInAction
  .metadata({ name: "signOut" })
  .action(async ({ ctx: { user } }) => signOut(user, await headers()));
