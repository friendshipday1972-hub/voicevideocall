import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bn } from '../src/i18n/locales/bn.ts';
import { en } from '../src/i18n/locales/en.ts';
import { hi } from '../src/i18n/locales/hi.ts';
import { kn } from '../src/i18n/locales/kn.ts';
import { ml } from '../src/i18n/locales/ml.ts';
import { mr } from '../src/i18n/locales/mr.ts';
import { ta } from '../src/i18n/locales/ta.ts';
import { te } from '../src/i18n/locales/te.ts';

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
const locales = { hi, te, ta, kn, ml, bn, mr };

for (const [code, dict] of Object.entries(locales)) {
  const flat = flatten(dict as unknown as Tree);

  test(`${code}: has exactly the English keys`, () => {
    assert.deepEqual(Object.keys(flat).sort(), Object.keys(source).sort());
  });

  test(`${code}: every {placeholder} matches English`, () => {
    for (const [key, text] of Object.entries(source)) {
      assert.deepEqual(placeholders(flat[key]), placeholders(text), `${code}.${key}`);
    }
  });

  test(`${code}: is actually translated (not an English copy)`, () => {
    const same = Object.entries(source).filter(([k, v]) => v.length > 12 && flat[k] === v);
    assert.equal(same.length, 0, same.map(([k]) => k).join(', '));
  });

  test(`${code}: no empty strings except the empty tier label`, () => {
    const empty = Object.entries(flat).filter(([k, v]) => v === '' && k !== 'tier.none');
    assert.equal(empty.length, 0, empty.map(([k]) => k).join(', '));
  });
}
