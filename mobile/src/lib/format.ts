import { dateLocale, translate, type UiLanguage } from '@/i18n';

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function localeString(d: Date, lang: UiLanguage, options: Intl.DateTimeFormatOptions, kind: 'time' | 'date'): string {
  try {
    return kind === 'time' ? d.toLocaleTimeString(dateLocale(lang), options) : d.toLocaleDateString(dateLocale(lang), options);
  } catch {
    return kind === 'time' ? d.toLocaleTimeString('en-IN', options) : d.toLocaleDateString('en-IN', options);
  }
}

/** "Today, 9:15 pm" / "Yesterday, …" / "21 Oct, …" in the given app language (pass it, so cached renders update). */
export function formatWhen(ts: number, lang: UiLanguage, now: number = Date.now()): string {
  const d = new Date(ts);
  const today = new Date(now).setHours(0, 0, 0, 0);
  const time = localeString(d, lang, { hour: 'numeric', minute: '2-digit' }, 'time');
  if (ts >= today) return translate(lang, 'common.today', { time });
  if (ts >= today - 86_400_000) return translate(lang, 'common.yesterday', { time });
  return `${localeString(d, lang, { day: 'numeric', month: 'short' }, 'date')}, ${time}`;
}
