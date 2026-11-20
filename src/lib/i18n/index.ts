import { arDictionary, type Dictionary } from "./ar";

export type SupportedLocale = "ar";

export const DEFAULT_LOCALE: SupportedLocale = "ar";

export function getDictionary(locale: SupportedLocale = "ar"): Dictionary {
  switch (locale) {
    case "ar":
    default:
      return arDictionary;
  }
}
