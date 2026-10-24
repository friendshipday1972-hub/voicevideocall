import { getLocales } from 'expo-localization';

export const UI_LANGUAGES = ['en', 'hi', 'te', 'ta', 'kn', 'ml', 'bn', 'mr'] as const;
export type UiLanguage = (typeof UI_LANGUAGES)[number];

/** First launch: use the phone's language if the app supports it, else English. */
export function detectLanguage(): UiLanguage {
  try {
    for (const l of getLocales()) {
      const code = l.languageCode as UiLanguage | null;
      if (code && (UI_LANGUAGES as readonly string[]).includes(code)) return code;
    }
  } catch {
    // Localization unavailable (e.g. tests): fall through.
  }
  return 'en';
}
