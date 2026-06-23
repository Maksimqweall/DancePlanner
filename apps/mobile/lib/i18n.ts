import { en } from "../locales/en";
import { ru } from "../locales/ru";
import { uk } from "../locales/uk";
import { de } from "../locales/de";
import { useLanguageStore, type Language } from "../store/useLanguageStore";

export type { Translations } from "../locales/en";

const translations: Record<Language, typeof en> = { en, ru, uk, de };

/** Returns the current translation object. Use this hook in any component. */
export function useT() {
  const language = useLanguageStore((s) => s.language);
  return translations[language] ?? translations.en;
}
