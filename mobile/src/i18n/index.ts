import { useCallback } from 'react';

import { useSession } from '@/stores/session';

import type { UiLanguage } from './detect';
import { bn } from './locales/bn';
import { en, type Dict } from './locales/en';
import { hi } from './locales/hi';
import { kn } from './locales/kn';
import { ml } from './locales/ml';
import { mr } from './locales/mr';
import { ta } from './locales/ta';
import { te } from './locales/te';

export { UI_LANGUAGES, detectLanguage, type UiLanguage } from './detect';

/** Every language must define every key (enforced by the `Dict` type in each locale file). */
const DICTS: Record<UiLanguage, Dict> = { en, hi, te, ta, kn, ml, bn, mr };

type Paths<T, P extends string = ''> = { [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`> }[keyof T & string];
export type TKey = Paths<Dict>;
export type TVars = Record<string, string | number>;

function lookup(dict: Dict, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (node && typeof node === 'object') node = (node as Record<string, unknown>)[part];
    else return undefined;
  }
  return typeof node === 'string' ? node : undefined;
}

export function translate(lang: UiLanguage, key: TKey, vars?: TVars): string {
  const raw = lookup(DICTS[lang], key) ?? lookup(en, key) ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m)) : raw;
}

/** Translator bound to the current app language; components re-render when it changes. */
export function useT() {
  const lang = useSession((s) => s.uiLanguage);
  return useCallback((key: TKey, vars?: TVars) => translate(lang, key, vars), [lang]);
}

export function useLanguage(): UiLanguage {
  return useSession((s) => s.uiLanguage);
}

/** For code outside React (store toasts, helpers called during render). */
export function t(key: TKey, vars?: TVars): string {
  return translate(useSession.getState().uiLanguage, key, vars);
}

/** Locale for dates (month/day names follow the app language; digits stay Latin, as is usual in Indian apps). */
export function dateLocale(lang: UiLanguage = useSession.getState().uiLanguage): string {
  return `${lang}-IN-u-nu-latn`;
}

/** Indic scripts have marks above and below the line, so text needs more line height. */
export function lineHeightScale(lang: UiLanguage): number {
  return lang === 'en' ? 1 : 1.22;
}
