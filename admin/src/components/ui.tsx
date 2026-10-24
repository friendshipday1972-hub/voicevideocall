'use client';

import clsx from 'clsx';
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, ChevronLeft, ChevronRight, Info, Loader2, X, XCircle, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { create } from 'zustand';

import { useT } from '@/i18n';

export const cx = clsx;

/* ───────── Layout ───────── */

export function Card({ children, className, title, action, description }: { children: ReactNode; className?: string; title?: string; action?: ReactNode; description?: string }) {
  return (
    <section className={cx('rounded-xl border border-line bg-surface', className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="font-display text-[15px] font-semibold text-fg">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-fg-3">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cx(title || action ? 'p-4' : '')}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight text-fg sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-fg-2">{description}</p>}
      </div>
      {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-surface-2">
        <Icon className="size-5 text-fg-3" aria-hidden />
      </div>
      <p className="font-medium text-fg">{title}</p>
      {body && <p className="max-w-sm text-sm text-fg-3">{body}</p>}
    </div>
  );
}

/* ───────── Controls ───────── */

type ButtonProps = {
  children?: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md';
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
  title?: string;
  className?: string;
  'aria-label'?: string;
};

export function Button({ children, variant = 'secondary', size = 'md', icon: Icon, loading, disabled, onClick, type = 'button', title, className, ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      title={title}
      aria-label={rest['aria-label']}
      onClick={onClick}
      disabled={disabled || loading}
      className={cx(
        'inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
        variant === 'primary' && 'bg-brand text-brand-fg hover:opacity-90',
        variant === 'secondary' && 'border border-line bg-surface text-fg hover:bg-surface-2',
        variant === 'ghost' && 'text-fg-2 hover:bg-surface-2 hover:text-fg',
        variant === 'danger' && 'bg-bad text-white hover:opacity-90',
        variant === 'success' && 'bg-good text-white hover:opacity-90 dark:text-black',
        className,
      )}>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : Icon ? <Icon className={size === 'sm' ? 'size-3.5' : 'size-4'} aria-hidden /> : null}
      {children}
    </button>
  );
}

export type Tone = 'good' | 'warn' | 'bad' | 'info' | 'neutral' | 'brand' | 'gold';

const TONE: Record<Tone, string> = {
  good: 'bg-good-soft text-good',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  info: 'bg-info-soft text-info',
  neutral: 'bg-surface-2 text-fg-2',
  brand: 'bg-brand-soft text-brand',
  gold: 'bg-warn-soft text-gold',
};

/** Status is never color-only: every pill carries an icon or a word. */
export function Pill({ tone = 'neutral', icon: Icon, children, className }: { tone?: Tone; icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', TONE[tone], className)}>
      {Icon && <Icon className="size-3" aria-hidden />}
      {children}
    </span>
  );
}

export function Kpi({ label, value, delta, deltaLabel, icon: Icon, href, tone, sub }: { label: string; value: string; delta?: number; deltaLabel?: string; icon: LucideIcon; href?: string; tone?: Tone; sub?: string }) {
  const t = useT();
  const body = (
    <div className={cx('h-full rounded-xl border border-line bg-surface p-3 transition-colors sm:p-4', href && 'hover:border-fg-3')}>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-xs font-medium text-fg-3">{label}</p>
        <span className={cx('grid size-7 shrink-0 place-items-center rounded-lg', tone ? TONE[tone] : 'bg-surface-2 text-fg-2')}>
          <Icon className="size-3.5" aria-hidden />
        </span>
      </div>
      <p className="tabular mt-2 break-words font-display text-xl font-semibold text-fg sm:text-2xl">{value}</p>
      <div className="mt-1 flex min-h-4 flex-wrap items-center gap-1 text-xs">
        {delta !== undefined && Number.isFinite(delta) && (
          <span className={cx('inline-flex items-center gap-0.5 font-medium', delta >= 0 ? 'text-good' : 'text-bad')}>
            {delta >= 0 ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />}
            {Math.abs(Math.round(delta * 100))}%
          </span>
        )}
        <span className="text-fg-3">{delta !== undefined && Number.isFinite(delta) ? (deltaLabel ?? t('common.vsYesterday')) : sub}</span>
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-xl">
      {body}
    </Link>
  ) : (
    body
  );
}

export function Field({ label, children, hint, error }: { label: string; children: (id: string) => ReactNode; hint?: string; error?: string | null }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-fg-2">
        {label}
      </label>
      {children(id)}
      {error ? (
        <p className="text-xs text-bad" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-fg-3">{hint}</p>
      ) : null}
    </div>
  );
}

const inputBase = 'h-9 rounded-lg border border-line bg-surface px-3 text-sm text-fg placeholder:text-fg-3 focus:border-data focus:outline-none';
export const inputClass = `${inputBase} w-full`;

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className={cx(inputBase, 'w-full sm:w-64')} />;
}

export function Select<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as T)} className={cx(inputBase, 'w-auto max-w-full cursor-pointer pr-8')}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string; count?: number }[] }) {
  return (
    <div role="tablist" className="-mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cx(
            '-mb-px flex cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            value === t.value ? 'border-brand text-fg' : 'border-transparent text-fg-3 hover:text-fg',
          )}>
          {t.label}
          {t.count !== undefined && <span className="tabular rounded-full bg-surface-2 px-1.5 text-xs text-fg-2">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ───────── Table ───────── */

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  sort?: (row: T) => number | string;
  align?: 'left' | 'right';
  className?: string;
};

/**
 * Sortable, paged table. Below the md breakpoint each row becomes a card: the first column is the
 * title, the other columns are labelled values, and header-less columns (row actions) sit at the bottom.
 */
export function DataTable<T>({ rows, columns, rowKey, onRowClick, pageSize = 15, empty, initialSort }: { rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string; onRowClick?: (r: T) => void; pageSize?: number; empty?: ReactNode; initialSort?: { key: string; dir: 'asc' | 'desc' } }) {
  const t = useT();
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(0);
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort?.key);
    if (!col?.sort || !sort) return rows;
    const get = col.sort;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [rows, columns, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = sorted.slice(current * pageSize, current * pageSize + pageSize);

  if (rows.length === 0) return <>{empty}</>;

  const [titleCol, ...restCols] = columns;
  const fieldCols = restCols.filter((c) => c.header);
  const actionCols = restCols.filter((c) => !c.header);

  return (
    <div>
      <ul className="flex flex-col md:hidden">
        {visible.map((r) => (
          <li
            key={rowKey(r)}
            onClick={onRowClick ? () => onRowClick(r) : undefined}
            onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(r) : undefined}
            tabIndex={onRowClick ? 0 : undefined}
            className={cx('flex flex-col gap-2.5 border-b border-line p-3 last:border-0', onRowClick && 'cursor-pointer active:bg-surface-2')}>
            <div className="min-w-0 text-sm">{titleCol.cell(r)}</div>
            {fieldCols.length > 0 && (
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                {fieldCols.map((c) => (
                  <div key={c.key} className="min-w-0">
                    <dt className="text-[11px] text-fg-3">{c.header}</dt>
                    <dd className="tabular min-w-0 break-words">{c.cell(r)}</dd>
                  </div>
                ))}
              </dl>
            )}
            {actionCols.length > 0 && (
              <div className="flex flex-wrap justify-end gap-1 empty:hidden" onClick={(e) => e.stopPropagation()}>
                {actionCols.map((c) => (
                  <span key={c.key} className="contents">
                    {c.cell(r)}
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cx('whitespace-nowrap px-3 py-2.5 text-xs font-medium text-fg-3', c.align === 'right' ? 'text-right' : 'text-left', c.className)}>
                    {c.sort ? (
                      <button
                        className="inline-flex cursor-pointer items-center gap-1 hover:text-fg"
                        onClick={() => {
                          setSort(active && sort.dir === 'desc' ? { key: c.key, dir: 'asc' } : { key: c.key, dir: 'desc' });
                          setPage(0);
                        }}>
                        {c.header}
                        {active ? sort.dir === 'asc' ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden /> : <ArrowUpDown className="size-3 opacity-50" aria-hidden />}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr
                key={rowKey(r)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(r) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                className={cx('border-b border-line last:border-0 transition-colors', onRowClick && 'cursor-pointer hover:bg-surface-2 focus-visible:bg-surface-2')}>
                {columns.map((c) => (
                  <td key={c.key} className={cx('px-3 py-2.5 align-middle', c.align === 'right' && 'tabular text-right', c.className)}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2 text-xs text-fg-3">
          <span className="tabular">{t('common.pageOf', { from: current * pageSize + 1, to: Math.min(sorted.length, (current + 1) * pageSize), total: sorted.length })}</span>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" icon={ChevronLeft} disabled={current === 0} onClick={() => setPage(current - 1)} aria-label={t('common.previousPage')} />
            <Button size="sm" variant="ghost" icon={ChevronRight} disabled={current >= pages - 1} onClick={() => setPage(current + 1)} aria-label={t('common.nextPage')} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────── Modal & confirm ───────── */

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input, textarea, select, button')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-[var(--scrim)]" onClick={onClose} aria-hidden />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={cx('animate-in relative max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl border border-line bg-surface shadow-2xl sm:rounded-2xl', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
          <h2 className="font-display text-base font-semibold">{title}</h2>
          <Button variant="ghost" size="sm" icon={X} onClick={onClose} aria-label={t('common.close')} />
        </div>
        <div className="px-4 py-4 sm:px-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3 sm:px-5">{footer}</div>}
      </div>
    </div>
  );
}

/** Destructive or money-moving actions always ask for a reason, which goes to the audit log. */
export function ConfirmAction({
  open,
  onClose,
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
  reasonRequired = true,
  placeholder,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: (reason: string) => void;
  reasonRequired?: boolean;
  placeholder?: string;
}) {
  const t = useT();
  const [reason, setReason] = useState('');
  const close = () => {
    setReason('');
    onClose();
  };
  const valid = !reasonRequired || reason.trim().length >= 3;
  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            disabled={!valid}
            onClick={() => {
              onConfirm(reason.trim());
              close();
            }}>
            {confirmLabel}
          </Button>
        </>
      }>
      {body && <div className="mb-3 text-sm text-fg-2">{body}</div>}
      <Field label={reasonRequired ? t('common.reasonRequired') : t('common.noteOptional')}>
        {(id) => <textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={placeholder ?? t('common.reasonPlaceholder')} rows={3} className={cx(inputClass, 'h-auto py-2')} />}
      </Field>
    </Modal>
  );
}

/* ───────── Toasts ───────── */

type ToastItem = { id: number; tone: 'good' | 'bad' | 'info'; text: string };
const useToasts = create<{ items: ToastItem[]; push: (t: Omit<ToastItem, 'id'>) => void; remove: (id: number) => void }>((set) => ({
  items: [],
  push: (t) => {
    const id = Date.now() + Math.random();
    set((s) => ({ items: [...s.items, { ...t, id }].slice(-3) }));
    setTimeout(() => set((s) => ({ items: s.items.filter((i) => i.id !== id) })), 3500);
  },
  remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}));

export const toast = {
  good: (text: string) => useToasts.getState().push({ tone: 'good', text }),
  bad: (text: string) => useToasts.getState().push({ tone: 'bad', text }),
  info: (text: string) => useToasts.getState().push({ tone: 'info', text }),
};

export function Toaster() {
  const t = useT();
  const items = useToasts((s) => s.items);
  const remove = useToasts((s) => s.remove);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4">
      {items.map((item) => {
        const Icon = item.tone === 'good' ? CheckCircle2 : item.tone === 'bad' ? XCircle : Info;
        return (
          <div key={item.id} className="animate-in pointer-events-auto flex w-full max-w-md items-center gap-2.5 rounded-xl border border-line bg-surface px-4 py-3 text-sm shadow-lg">
            <Icon className={cx('size-4 shrink-0', item.tone === 'good' ? 'text-good' : item.tone === 'bad' ? 'text-bad' : 'text-info')} aria-hidden />
            <span className="flex-1">{item.text}</span>
            <button className="cursor-pointer text-fg-3 hover:text-fg" onClick={() => remove(item.id)} aria-label={t('common.dismiss')}>
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function Warning({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function Avatar({ name, colors, size = 32 }: { name: string; colors?: [string, string]; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-grid shrink-0 place-items-center rounded-full font-display font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.42, background: colors ? `linear-gradient(135deg, ${colors[0]}, ${colors[1]})` : 'linear-gradient(135deg, #64748b, #334155)' }}>
      {name[0]}
    </span>
  );
}
