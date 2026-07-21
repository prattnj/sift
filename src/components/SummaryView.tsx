import { useMemo, useState } from 'react'
import type { Category, Transaction } from '../types'
import { fmtUSD, fmtUSDPlain } from '../lib/format'
import { IGNORED_CATEGORY, IGNORED_CATEGORY_ID } from '../lib/storage'

interface Props {
  transactions: Transaction[]
  categories: Category[]
  onBack: () => void
  onStartOver: () => void
}

interface Row {
  category: Category
  debit: number
  credit: number
  count: number
}

export default function SummaryView({ transactions, categories, onBack, onStartOver }: Props) {
  const [copied, setCopied] = useState<'debit' | 'full' | null>(null)

  const { rows, totalDebit, totalCredit, uncategorized, ignoredCount, ignoredAmount } = useMemo(() => {
    const map = new Map<string, Row>()
    let totalDebit = 0
    let totalCredit = 0
    let uncategorized = 0
    let ignoredCount = 0
    let ignoredAmount = 0
    for (const t of transactions) {
      if (!t.categoryId) {
        uncategorized++
        continue
      }
      if (t.categoryId === IGNORED_CATEGORY_ID) {
        ignoredCount++
        ignoredAmount += t.amount
        continue
      }
      const cat = categories.find((c) => c.id === t.categoryId)
      if (!cat) continue
      const row = map.get(cat.id) ?? { category: cat, debit: 0, credit: 0, count: 0 }
      if (t.type === 'debit') {
        row.debit += t.amount
        totalDebit += t.amount
      } else {
        row.credit += t.amount
        totalCredit += t.amount
      }
      row.count++
      map.set(cat.id, row)
    }
    const rows = [...map.values()].sort((a, b) => b.debit - a.debit)
    return { rows, totalDebit, totalCredit, uncategorized, ignoredCount, ignoredAmount }
  }, [transactions, categories])

  const copy = (mode: 'debit' | 'full') => {
    const lines = rows.map((r) =>
      mode === 'debit'
        ? `${r.category.name}\t${fmtUSDPlain(r.debit)}`
        : `${r.category.name}\t${fmtUSDPlain(r.debit)}\t${fmtUSDPlain(r.credit)}\t${r.count}`,
    )
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(mode)
      setTimeout(() => setCopied(null), 1800)
    })
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 animate-rise">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold gold-text">Summary</h1>
          <p className="mt-1 text-sm text-slate-400">
            {transactions.length} transactions · {rows.length} categories
            {uncategorized > 0 && (
              <span className="text-amber-400"> · {uncategorized} uncategorized</span>
            )}
            {ignoredCount > 0 && (
              <span className="text-slate-500"> · {ignoredCount} ignored</span>
            )}
          </p>
        </div>
        <button
          onClick={onBack}
          className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-slate-300 transition-colors hover:border-ink-600 hover:bg-ink-800"
        >
          ← Keep editing
        </button>
      </div>

      {/* Totals cards */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatCard label="Total spent" value={fmtUSD(totalDebit)} tone="debit" />
        <StatCard label="Total received" value={fmtUSD(totalCredit)} tone="credit" />
        <StatCard label="Net" value={fmtUSD(totalCredit - totalDebit)} tone="net" />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-700 text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 text-right font-medium">Spent</th>
              <th className="px-4 py-3 text-right font-medium">Received</th>
              <th className="px-4 py-3 text-right font-medium">#</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.category.id} className="border-b border-ink-800 last:border-0 hover:bg-ink-800/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.category.color }} />
                    <span className="text-slate-200">{r.category.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-medium text-slate-100">
                  {r.debit > 0 ? fmtUSD(r.debit) : <span className="text-slate-600">—</span>}
                </td>
                <td className="px-4 py-3 text-right text-emerald-400">
                  {r.credit > 0 ? fmtUSD(r.credit) : <span className="text-slate-600">—</span>}
                </td>
                <td className="px-4 py-3 text-right text-slate-500">{r.count}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-600">
                  No categorized transactions yet.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-ink-700 font-semibold">
                <td className="px-4 py-3 text-slate-300">Total</td>
                <td className="px-4 py-3 text-right text-white">{fmtUSD(totalDebit)}</td>
                <td className="px-4 py-3 text-right text-emerald-400">{fmtUSD(totalCredit)}</td>
                <td className="px-4 py-3 text-right text-slate-500">
                  {rows.reduce((s, r) => s + r.count, 0)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {ignoredCount > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-ink-700 bg-ink-900/40 px-4 py-3 text-sm">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: IGNORED_CATEGORY.color }} />
          <span className="text-slate-400">Ignored</span>
          <span className="text-slate-600">— {ignoredCount} txn{ignoredCount === 1 ? '' : 's'}, {fmtUSD(ignoredAmount)}</span>
          <span className="ml-auto text-xs italic text-slate-600">excluded from totals</span>
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={() => copy('debit')}
          className="flex-1 rounded-xl bg-gold-500 py-3 font-semibold text-ink-950 transition-colors hover:bg-gold-400"
        >
          {copied === 'debit' ? '✓ Copied' : 'Copy spending (name + total)'}
        </button>
        <button
          onClick={() => copy('full')}
          className="flex-1 rounded-xl border border-ink-700 py-3 font-semibold text-slate-300 transition-colors hover:border-gold-600/60 hover:text-gold-400"
        >
          {copied === 'full' ? '✓ Copied' : 'Copy full table'}
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-slate-600">
        Copied as tab-separated values — paste straight into your spreadsheet.
      </p>

      <button
        onClick={onStartOver}
        className="mt-6 w-full rounded-lg py-2.5 text-sm text-slate-500 transition-colors hover:text-red-400"
      >
        Start over with a new file
      </button>
    </div>
  )
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: 'debit' | 'credit' | 'net' }) {
  const color =
    tone === 'credit' ? 'text-emerald-400' : tone === 'net' ? 'text-gold-400' : 'text-white'
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${color}`}>{value}</p>
    </div>
  )
}
