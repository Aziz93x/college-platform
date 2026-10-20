import type messages from "./messages/ar.json";

// Types the message keys for useTranslations and getTranslations (next-intl AppConfig).
declare module "next-intl" {
  interface AppConfig {
    Messages: typeof messages;
  }
}
