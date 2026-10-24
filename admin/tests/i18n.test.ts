import assert from 'node:assert/strict';
import { test } from 'node:test';

import { en } from '../src/i18n/en.ts';
import { te } from '../src/i18n/te.ts';

type Tree = { [k: string]: string | Tree };

function flatten(node: Tree, prefix = '', out: Record<string, string> = {}) {
  for (const [k, v] of Object.entries(node)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else flatten(v, key, out);
  }
  return out;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const source = flatten(en as unknown as Tree);
const telugu = flatten(te as unknown as Tree);

test('te: has exactly the English keys', () => {
  assert.deepEqual(Object.keys(telugu).sort(), Object.keys(source).sort());
});

test('te: every {placeholder} matches English', () => {
  for (const [key, text] of Object.entries(source)) assert.deepEqual(placeholders(telugu[key]), placeholders(text), key);
});

test('te: longer strings are actually translated', () => {
  // Pure format strings like "{user} ↔ {host} · {type}" have no words to translate.
  const hasWords = (v: string) => /[A-Za-z]{3,}/.test(v.replace(/\{\w+\}/g, ''));
  const same = Object.entries(source).filter(([k, v]) => v.length > 12 && hasWords(v) && telugu[k] === v);
  assert.equal(same.length, 0, same.map(([k]) => k).join(', '));
});

test('te: no empty strings except the empty tier label', () => {
  const empty = Object.entries(telugu).filter(([k, v]) => v === '' && k !== 'tier.none');
  assert.equal(empty.length, 0, empty.map(([k]) => k).join(', '));
});
