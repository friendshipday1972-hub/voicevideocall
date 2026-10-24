'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { en, type Dict } from './en';
import { te } from './te';

export type UiLang = 'en' | 'te';
export const UI_LANGS: { code: UiLang; native: string }[] = [
  { code: 'en', native: 'English' },
  { code: 'te', native: 'తెలుగు' },
];

const DICTS: Record<UiLang, Dict> = { en, te };

type Paths<T, P extends string = ''> = { [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`> }[keyof T & string];
export type TKey = Paths<typeof en>;
export type Vars = Record<string, string | number>;
export type Translate = (key: TKey, vars?: Vars) => string;

function lookup(dict: Dict, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split('.')) node = (node as Record<string, unknown> | undefined)?.[part];
  return typeof node === 'string' ? node : undefined;
}

export function translate(lang: UiLang, key: TKey, vars?: Vars): string {
  const text = lookup(DICTS[lang], key) ?? lookup(en, key) ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text;
}

/** Translates a key built from data (e.g. a stored tag); unknown values are shown as they are. */
export function translateMaybe(t: Translate, prefix: string, value: string): string {
  const key = `${prefix}.${value}` as TKey;
  const out = t(key);
  return out === key ? value : out;
}

/** Number and date formatting per language; digits stay Latin so amounts read the same in both. */
export function locale(lang: UiLang): string {
  return lang === 'te' ? 'te-IN-u-nu-latn' : 'en-IN';
}

const useLangStore = create<{ lang: UiLang; setLang: (lang: UiLang) => void }>()(
  persist((set) => ({ lang: 'en', setLang: (lang) => set({ lang }) }), { name: 'admin-lang', storage: createJSONStorage(() => localStorage) }),
);

export const setLang = (lang: UiLang) => useLangStore.getState().setLang(lang);

/** The server always renders English; the saved language takes over right after hydration. */
export function useLang(): UiLang {
  return useSyncExternalStore(
    (cb) => useLangStore.subscribe(cb),
    () => useLangStore.getState().lang,
    () => 'en',
  );
}

export function useT(): Translate {
  const lang = useLang();
  return useCallback((key: TKey, vars?: Vars) => translate(lang, key, vars), [lang]);
}
