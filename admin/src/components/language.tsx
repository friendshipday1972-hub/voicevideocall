'use client';

import { Languages } from 'lucide-react';
import { useEffect } from 'react';

import { UI_LANGS, setLang, useLang, useT } from '@/i18n';

import { cx } from './ui';

/** Two-button English / తెలుగు switch. Big, labelled in each language's own script, so anyone can find theirs. */
export function LanguageSwitch({ className }: { className?: string }) {
  const lang = useLang();
  const t = useT();

  // Keep <html lang> in sync so screen readers and fonts pick the right script.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <div role="group" aria-label={t('uiLang.label')} className={cx('flex items-center gap-0.5 rounded-lg border border-line bg-surface-2 p-0.5', className)}>
      <Languages className="mx-1 hidden size-4 text-fg-3 sm:block" aria-hidden />
      {UI_LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          lang={l.code}
          onClick={() => setLang(l.code)}
          aria-pressed={lang === l.code}
          aria-label={t('uiLang.switchTo', { name: l.native })}
          className={cx('h-8 cursor-pointer rounded-md px-2 text-xs font-medium transition-colors', lang === l.code ? 'bg-surface text-fg shadow-sm' : 'text-fg-3 hover:text-fg')}>
          {l.code === 'en' ? (
            'EN'
          ) : (
            <>
              <span className="sm:hidden">తె</span>
              <span className="hidden sm:inline">{l.native}</span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}
