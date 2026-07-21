import { useEffect, useMemo, useState } from 'react'
import type { Category, Transaction } from '../types'
import { fmtUSD } from '../lib/format'
import { IGNORED_CATEGORY, IGNORED_CATEGORY_ID } from '../lib/storage'

interface Props {
  transactions: Transaction[]
  index: number
  categories: Category[]
  onAssign: (categoryId: string, remember: boolean) => void
  onClear: () => void
  onNavigate: (index: number) => void
  onManageCategories: () => void
  onFinish: () => void
}

interface Totals {
  debit: number
  credit: number
  count: number
}

export default function CategorizeView({
  transactions,
  index,
  categories,
  onAssign,
  onClear,
  onNavigate,
  onManageCategories,
  onFinish,
}: Props) {
  const current = transactions[index]
  const catById = useMemo(
    () => new Map([...categories, IGNORED_CATEGORY].map((c) => [c.id, c])),
    [categories],
  )

  // Whether assigning should also save the merchant→category mapping. Defaults to true,
  // but resets to true for each transaction so a one-off opt-out doesn't stick.
  const [remember, setRemember] = useState(true)
  useEffect(() => {
    setRemember(true)
  }, [current?.id])

  const categorizedCount = transactions.filter((t) => t.categoryId).length
  const allDone = categorizedCount === transactions.length
  const pct = transactions.length ? (categorizedCount / transactions.length) * 100 : 0

  const totals = useMemo(() => {
    const map = new Map<string, Totals>()
    for (const t of transactions) {
      if (!t.categoryId) continue
      if (t.categoryId === IGNORED_CATEGORY_ID) continue // excluded from totals
      const cur = map.get(t.categoryId) ?? { debit: 0, credit: 0, count: 0 }
      if (t.type === 'debit') cur.debit += t.amount
      else cur.credit += t.amount
      cur.count++
      map.set(t.categoryId, cur)
    }
    return map
  }, [transactions])

  const ignoredCount = useMemo(
    () => transactions.filter((t) => t.categoryId === IGNORED_CATEGORY_ID).length,
    [transactions],
  )

  const isIgnored = current?.categoryId === IGNORED_CATEGORY_ID

  // Keyboard shortcuts: 1-9 assign category, 0 ignore, arrows navigate.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key >= '1' && e.key <= '9') {
        const i = Number(e.key) - 1
        if (categories[i]) onAssign(categories[i].id, remember)
      } else if (e.key === '0') {
        onAssign(IGNORED_CATEGORY_ID, remember)
      } else if (e.key === 'ArrowRight') {
        onNavigate(Math.min(index + 1, transactions.length - 1))
      } else if (e.key === 'ArrowLeft') {
        onNavigate(Math.max(index - 1, 0))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [categories, index, transactions.length, onAssign, onNavigate, remember])

  if (!current) return null

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Progress */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-slate-400">
            <span className="gold-text font-semibold">{categorizedCount}</span> of {transactions.length} categorized
          </span>
          <span className="text-slate-500">Transaction {index + 1}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold-600 to-gold-400 transition-all duration-500"
            style={{ width: `${pct}%`, boxShadow: '0 0 12px rgba(255,207,77,0.5)' }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main */}
        <div className="min-w-0">
          <TransactionCard current={current} category={current.categoryId ? catById.get(current.categoryId) : undefined} />

          {/* Category chips */}
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Assign a category
              </h3>
              <button
                onClick={onManageCategories}
                className="text-xs text-gold-400/80 hover:text-gold-400 transition-colors"
              >
                + Manage
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {categories.map((c, i) => {
                const active = current.categoryId === c.id
                return (
                  <button
                    key={c.id}
                    onClick={() => onAssign(c.id, remember)}
                    className={`group relative flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm transition-all ${
                      active
                        ? 'border-transparent bg-ink-700 gold-glow-sm'
                        : 'border-ink-700 bg-ink-850 hover:border-ink-600 hover:bg-ink-800'
                    }`}
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full ring-1 ring-white/10"
                      style={{ backgroundColor: c.color, boxShadow: active ? `0 0 8px ${c.color}` : undefined }}
                    />
                    <span className={`flex-1 truncate ${active ? 'text-white font-medium' : 'text-slate-300'}`}>
                      {c.name}
                    </span>
                    {i < 9 && (
                      <kbd className="rounded bg-ink-900 px-1.5 py-0.5 text-[10px] text-slate-500 group-hover:text-slate-400">
                        {i + 1}
                      </kbd>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Ignore — special category excluded from summary totals */}
            <button
              onClick={() => onAssign(IGNORED_CATEGORY_ID, remember)}
              className={`group mt-3 flex w-full items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm transition-all ${
                isIgnored
                  ? 'border-slate-500 bg-ink-700 text-white'
                  : 'border-dashed border-ink-600 bg-ink-850 text-slate-400 hover:border-slate-500 hover:bg-ink-800'
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
                <path
                  d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.4 5.1A9.5 9.5 0 0112 5c5 0 9 4 10 7a12 12 0 01-2.2 3.2M6.6 6.6C3.9 8 2.2 10.2 2 12c1 3 5 7 10 7 1.4 0 2.7-.3 3.9-.8"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="flex-1">
                Ignore this transaction
                <span className="ml-1 text-xs text-slate-500">(excluded from totals)</span>
              </span>
              <kbd className="rounded bg-ink-900 px-1.5 py-0.5 text-[10px] text-slate-500 group-hover:text-slate-400">
                0
              </kbd>
            </button>
            <label className="mt-3 flex cursor-pointer select-none items-center gap-2.5 text-sm">
              <button
                type="button"
                role="checkbox"
                aria-checked={remember}
                onClick={() => setRemember((r) => !r)}
                className={`flex h-5 w-5 items-center justify-center rounded-md border transition-all ${
                  remember
                    ? 'border-gold-500 bg-gold-500 gold-glow-sm'
                    : 'border-ink-600 bg-ink-850 hover:border-ink-500'
                }`}
              >
                {remember && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-ink-950">
                    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <span onClick={() => setRemember((r) => !r)} className="text-slate-300">
                Remember this merchant for next time
              </span>
            </label>
          </div>

          {/* Nav */}
          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              onClick={() => onNavigate(Math.max(index - 1, 0))}
              disabled={index === 0}
              className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-slate-300 transition-colors hover:border-ink-600 hover:bg-ink-800 disabled:opacity-30"
            >
              ← Prev
            </button>
            <div className="flex items-center gap-2">
              {current.categoryId && (
                <button
                  onClick={onClear}
                  className="rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:text-red-400"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => onNavigate(Math.min(index + 1, transactions.length - 1))}
                disabled={index === transactions.length - 1}
                className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-slate-300 transition-colors hover:border-ink-600 hover:bg-ink-800 disabled:opacity-30"
              >
                Skip / Next →
              </button>
            </div>
          </div>

          <button
            onClick={onFinish}
            className={`mt-6 w-full rounded-xl py-3 font-semibold transition-all ${
              allDone
                ? 'bg-gold-500 text-ink-950 hover:bg-gold-400 gold-glow'
                : 'border border-ink-700 text-slate-300 hover:border-gold-600/60 hover:text-gold-400'
            }`}
          >
            {allDone ? 'View Summary →' : `View Summary (${transactions.length - categorizedCount} left)`}
          </button>
        </div>

        {/* Totals sidebar */}
        <aside className="lg:sticky lg:top-6 h-fit">
          <div className="card p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Running totals
            </h3>
            <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
              {categories.map((c) => {
                const t = totals.get(c.id)
                if (!t) return null
                return (
                  <div key={c.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-ink-800">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="flex-1 truncate text-sm text-slate-300">{c.name}</span>
                    <div className="text-right">
                      {t.debit > 0 && <div className="text-sm font-medium text-slate-100">{fmtUSD(t.debit)}</div>}
                      {t.credit > 0 && <div className="text-xs text-emerald-400">+{fmtUSD(t.credit)}</div>}
                    </div>
                  </div>
                )
              })}
              {[...totals.values()].length === 0 && (
                <p className="py-4 text-center text-sm text-slate-600">Nothing categorized yet.</p>
              )}
            </div>
            {ignoredCount > 0 && (
              <div className="mt-2 flex items-center gap-2 border-t border-ink-700 px-2 pt-2 text-xs text-slate-500">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: IGNORED_CATEGORY.color }} />
                <span className="flex-1">Ignored</span>
                <span>
                  {ignoredCount} txn{ignoredCount === 1 ? '' : 's'} · excluded
                </span>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

function TransactionCard({ current, category }: { current: Transaction; category?: Category }) {
  return (
    <div key={current.id} className="card gold-glow-sm p-6 animate-pop">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                current.card === 'credit'
                  ? 'bg-violet-500/15 text-violet-300'
                  : 'bg-sky-500/15 text-sky-300'
              }`}
            >
              {current.card === 'credit' ? 'Credit Card' : 'Debit Card'}
            </span>
            <span className="text-xs text-slate-500">{current.date}</span>
            {current.autoSuggested && current.categoryId && (
              <span className="rounded-full bg-gold-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold-400">
                ✨ Auto
              </span>
            )}
          </div>
          <h2 className="mt-3 truncate text-2xl font-semibold text-white">{current.merchantName}</h2>
          <p className="mt-1 text-sm text-slate-500">{current.description}</p>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-3xl font-bold ${current.type === 'debit' ? 'text-white' : 'text-emerald-400'}`}>
            {current.type === 'credit' ? '+' : ''}
            {fmtUSD(current.amount)}
          </div>
          {category && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-ink-800 px-2.5 py-1 text-xs">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color }} />
              <span className="text-slate-300">{category.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Raw memo, for reference */}
      <details className="mt-4 border-t border-ink-700 pt-3">
        <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-400">
          Raw memo
        </summary>
        <p className="mt-2 break-words font-mono text-xs text-slate-500">{current.memo}</p>
      </details>
    </div>
  )
}
