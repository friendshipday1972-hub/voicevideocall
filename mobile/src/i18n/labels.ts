import type { TKey, TVars } from './index';

/** The translator returned by `useT()`. Helpers take it as an argument so cached renders update on language change. */
export type Translate = (key: TKey, vars?: TVars) => string;

const TAG_KEYS: Record<string, TKey> = {
  Friendly: 'rating.friendly',
  'Good listener': 'rating.goodListener',
  Funny: 'rating.funny',
  Respectful: 'rating.respectful',
  'Great advice': 'rating.greatAdvice',
  'Clear voice': 'rating.clearVoice',
};

/** Rating tags are stored in English (stable values for the backend) and shown in the app language. */
export function tagLabel(t: Translate, tag: string): string {
  const key = TAG_KEYS[tag];
  return key ? t(key) : tag;
}

export function languageName(t: Translate, code: string): string {
  return t(`lang.${code}` as TKey);
}

type EarningLabelData =
  | { kind: 'call'; type: 'audio' | 'video'; name: string }
  | { kind: 'gift'; gift: 'rose' | 'coffee' | 'heart' | 'star' | 'diamond'; name: string }
  | { kind: 'lastWeek' | 'thisWeek' | 'bonus' | 'withdrawal' };

/** A host earning line in the app language (older saved entries are plain strings). */
export function earningLabel(t: Translate, label: EarningLabelData | string): string {
  if (typeof label === 'string') return label;
  switch (label.kind) {
    case 'call':
      return t('earnings.label.call', { type: t(label.type === 'video' ? 'common.video' : 'common.voice'), name: label.name });
    case 'gift':
      return t('earnings.label.gift', { gift: t(`gifts.${label.gift}`), name: label.name });
    default:
      return t(`earnings.label.${label.kind}`);
  }
}
