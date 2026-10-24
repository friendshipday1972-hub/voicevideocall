'use client';

import { Table2 } from 'lucide-react';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Card, cx } from './ui';

/* Chart colors come from the theme tokens (SVG attributes can't resolve CSS variables), re-read when the theme changes. */
type ChartColors = { data: string; dataSoft: string; grid: string; text: string; surface: string; line: string };
const FALLBACK: ChartColors = { data: '#2a78d6', dataSoft: '#cde2fb', grid: '#e7e9ee', text: '#64748b', surface: '#ffffff', line: '#e2e5ea' };

let cached: ChartColors = FALLBACK;
let cachedKey = '';
function readColors(): ChartColors {
  const s = getComputedStyle(document.documentElement);
  const get = (v: string, f: string) => s.getPropertyValue(v).trim() || f;
  const next = { data: get('--data-1', FALLBACK.data), dataSoft: get('--data-1-soft', FALLBACK.dataSoft), grid: get('--grid', FALLBACK.grid), text: get('--fg-3', FALLBACK.text), surface: get('--surface', FALLBACK.surface), line: get('--line', FALLBACK.line) };
  const key = Object.values(next).join();
  if (key !== cachedKey) {
    cached = next;
    cachedKey = key;
  }
  return cached;
}
function subscribe(cb: () => void) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', cb);
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => {
    mq.removeEventListener('change', cb);
    mo.disconnect();
  };
}
function useChartColors(): ChartColors {
  return useSyncExternalStore(subscribe, readColors, () => FALLBACK);
}

type TooltipPayload = readonly { value?: unknown }[];
type Row = Record<string, string | number>;

function ChartTooltip({ active, payload, label, format, unit }: { active?: boolean; payload?: TooltipPayload; label?: string | number; format: (v: number) => string; unit: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="mb-0.5 text-fg-3">{label}</p>
      <p className="flex items-center gap-1.5 font-medium text-fg">
        <span className="inline-block h-0.5 w-3 rounded bg-data" aria-hidden />
        <span className="tabular">{format(Number(payload[0].value ?? 0))}</span>
        <span className="font-normal text-fg-3">{unit}</span>
      </p>
    </div>
  );
}

/** Chart card with a table-view toggle (charts are never the only way to read the numbers). */
function ChartCard({ title, description, data, xKey, yKey, format, unit, children, className }: { title: string; description?: string; data: Row[]; xKey: string; yKey: string; format: (v: number) => string; unit: string; children: ReactNode; className?: string }) {
  const [table, setTable] = useState(false);
  return (
    <Card
      title={title}
      description={description}
      className={className}
      action={
        <button onClick={() => setTable((t) => !t)} aria-pressed={table} className={cx('inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs text-fg-3 hover:bg-surface-2 hover:text-fg', table && 'bg-surface-2 text-fg')}>
          <Table2 className="size-3.5" aria-hidden />
          {table ? 'Chart' : 'Table'}
        </button>
      }>
      {table ? (
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <tbody>
              {data.map((d) => (
                <tr key={String(d[xKey])} className="border-b border-line last:border-0">
                  <td className="py-1.5 text-fg-2">{String(d[xKey])}</td>
                  <td className="tabular py-1.5 text-right font-medium">
                    {format(Number(d[yKey]))} <span className="font-normal text-fg-3">{unit}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-64" role="img" aria-label={`${title} chart. Use the Table button for exact values.`}>
          {children}
        </div>
      )}
    </Card>
  );
}

export function TrendChart({ title, description, data, xKey, yKey, format, unit, className }: { title: string; description?: string; data: Row[]; xKey: string; yKey: string; format: (v: number) => string; unit: string; className?: string }) {
  const c = useChartColors();
  return (
    <ChartCard title={title} description={description} data={data} xKey={xKey} yKey={yKey} format={format} unit={unit} className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`fill-${yKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.data} stopOpacity={0.22} />
              <stop offset="100%" stopColor={c.data} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey={xKey} tick={{ fill: c.text, fontSize: 11 }} tickLine={false} axisLine={{ stroke: c.line }} interval="preserveStartEnd" minTickGap={24} />
          <YAxis tick={{ fill: c.text, fontSize: 11 }} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => format(v)} />
          <Tooltip cursor={{ stroke: c.text, strokeWidth: 1, strokeDasharray: '3 3' }} content={(p) => <ChartTooltip active={p.active} payload={p.payload} label={p.label} format={format} unit={unit} />} />
          <Area type="monotone" dataKey={yKey} stroke={c.data} strokeWidth={2} fill={`url(#fill-${yKey})`} activeDot={{ r: 4, stroke: c.surface, strokeWidth: 2, fill: c.data }} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function BarsChart({ title, description, data, xKey, yKey, format, unit, className }: { title: string; description?: string; data: Row[]; xKey: string; yKey: string; format: (v: number) => string; unit: string; className?: string }) {
  const c = useChartColors();
  return (
    <ChartCard title={title} description={description} data={data} xKey={xKey} yKey={yKey} format={format} unit={unit} className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey={xKey} tick={{ fill: c.text, fontSize: 11 }} tickLine={false} axisLine={{ stroke: c.line }} interval="preserveStartEnd" minTickGap={12} />
          <YAxis tick={{ fill: c.text, fontSize: 11 }} tickLine={false} axisLine={false} width={40} tickFormatter={(v: number) => format(v)} />
          <Tooltip cursor={{ fill: c.grid, opacity: 0.6 }} content={(p) => <ChartTooltip active={p.active} payload={p.payload} label={p.label} format={format} unit={unit} />} />
          <Bar dataKey={yKey} fill={c.data} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** Horizontal bars in plain HTML: labels and values are always visible, so no tooltip is needed. */
export function BarList({ items, format = (v) => v.toLocaleString('en-IN'), max }: { items: { label: string; value: number; hint?: string }[]; format?: (v: number) => string; max?: number }) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((i) => (
        <li key={i.label}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="text-fg-2">{i.label}</span>
            <span className="tabular font-medium">
              {format(i.value)}
              {i.hint && <span className="ml-1.5 text-xs font-normal text-fg-3">{i.hint}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-data" style={{ width: `${Math.max(1.5, (i.value / top) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
