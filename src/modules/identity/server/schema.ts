import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { colleges } from "../../org/index.ts";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// Better Auth's tables (user, session, account, verification and the two-factor plugin's), with the
// property names its Drizzle adapter reads. Ids come from the database: generateId is false.

export const users = pgTable("users", {
  id: uuid().primaryKey().default(sql`uuidv7()`),
  name: text().notNull(),
  // Stored lowercase: sign-in lowercases the email it looks up.
  email: text().notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text(),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  // Set by an admin's reset and by admin:create; cleared when the person sets their own password.
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    token: text().notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    // "Remember this device": set by sign-in.ts once the session exists, and copied by Better Auth
    // when it replaces a session (two-factor setup), so it has no default there.
    remembered: boolean().notNull().default(false),
    // The last request the session made, for the idle timeout; written at most once a minute.
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text(),
    // The password hash, on the credential account.
    password: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("accounts_user_id_idx").on(table.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
);

export const twoFactors = pgTable(
  "two_factors",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    // The TOTP secret and the backup codes, encrypted with AUTH_SECRET.
    secret: text().notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    verified: boolean().notNull().default(true),
    failedVerificationCount: integer("failed_verification_count")
      .notNull()
      .default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
  },
  (table) => [index("two_factors_user_id_idx").on(table.userId)],
);

// The person behind an account: what the platform knows about them beyond sign-in.
export const people = pgTable(
  "people",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    collegeId: uuid("college_id")
      .notNull()
      .references(() => colleges.id),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    // Digits only, as typed into Rayat; people sign in with it.
    employeeNumber: text("employee_number").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [unique().on(table.collegeId, table.employeeNumber)],
);

// Sign-in attempts per identifier and address, in windows set by the sign-in settings.
export const signInAttempts = pgTable("sign_in_attempts", {
  key: text().primaryKey(),
  attempts: integer().notNull(),
  windowStartedAt: timestamp("window_started_at", {
    withTimezone: true,
  }).notNull(),
});

// Sign-in attempts per identifier as typed, with or without an account (lockout.ts). Each attempt
// is counted before its password is checked and a sign-in clears the count, so at rest it holds
// the wrong ones. startedAt is the count's first attempt, then the lock's start once it locks.
export const signInLockouts = pgTable("sign_in_lockouts", {
  subject: text().primaryKey(),
  attempts: integer().notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
});
