import { useRef, useState } from 'react'
import { parseCsv } from '../lib/parse'
import type { Transaction } from '../types'

interface Props {
  onLoaded: (txns: Transaction[], fileName: string) => void
  hasSession: boolean
  onResume: () => void
}

export default function UploadView({ onLoaded, hasSession, onResume }: Props) {
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pasteText, setPasteText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleText = (text: string, fileName: string) => {
    setError(null)
    const result = parseCsv(text)
    if (result.transactions.length === 0) {
      setError(
        result.errors[0] ??
          'No transactions found. Make sure this is a bank CSV export with Date / Memo / Amount columns.',
      )
      return
    }
    onLoaded(result.transactions, fileName)
  }

  const handleFiles = async (files: FileList | null) => {
    setError(null)
    if (!files || files.length === 0) return
    const list = Array.from(files)

    const invalid = list.find((f) => !/\.csv$/i.test(f.name) && f.type !== 'text/csv')
    if (invalid) {
      setError(`"${invalid.name}" is not a .csv file. Please upload CSV files only.`)
      return
    }

    const combined: Transaction[] = []
    const failed: string[] = []
    for (const file of list) {
      const text = await file.text()
      const result = parseCsv(text)
      if (result.transactions.length === 0) failed.push(file.name)
      else combined.push(...result.transactions)
    }

    if (combined.length === 0) {
      setError(
        'No transactions found. Make sure these are bank CSV exports with Date / Memo / Amount columns.',
      )
      return
    }
    if (failed.length) {
      setError(`Skipped ${failed.length} file(s) with no readable transactions: ${failed.join(', ')}.`)
    }

    const name =
      list.length === 1 ? list[0].name : `${list.length} files (${combined.length} transactions)`
    onLoaded(combined, name)
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10 animate-rise">
      {hasSession && (
        <button
          onClick={onResume}
          className="w-full mb-6 card gold-glow-sm px-5 py-4 flex items-center justify-between hover:border-gold-500 transition-colors text-left"
        >
          <div>
            <p className="text-sm font-semibold text-gold-400">Resume in-progress session</p>
            <p className="text-xs text-slate-400 mt-0.5">Pick up where you left off.</p>
          </div>
          <span className="text-gold-400 text-lg">→</span>
        </button>
      )}

      <label
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
        className={`block cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all ${
          dragging
            ? 'border-gold-500 bg-gold-500/5 gold-glow'
            : 'border-ink-600 hover:border-gold-600/60 hover:bg-ink-850/50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-ink-800 ring-1 ring-gold-600/30">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="text-gold-400">
            <path
              d="M12 16V4m0 0L7 9m5-5l5 5M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className="text-base font-medium">
          Drop your bank <span className="gold-text font-semibold">.csv</span> files here
        </p>
        <p className="mt-1 text-sm text-slate-400">
          one or more — click to browse (credit + debit together)
        </p>
      </label>

      <div className="my-6 flex items-center gap-4 text-xs uppercase tracking-widest text-slate-600">
        <div className="h-px flex-1 bg-ink-700" />
        or paste csv text
        <div className="h-px flex-1 bg-ink-700" />
      </div>

      <textarea
        value={pasteText}
        onChange={(e) => setPasteText(e.target.value)}
        placeholder="Paste the raw CSV contents here…"
        rows={5}
        className="w-full resize-y rounded-xl bg-ink-900 border border-ink-600 px-4 py-3 text-sm font-mono outline-none focus:border-gold-500 focus:gold-glow-sm transition-all"
      />
      <button
        disabled={!pasteText.trim()}
        onClick={() => handleText(pasteText, 'pasted.csv')}
        className="mt-3 w-full rounded-xl bg-gold-500 py-3 font-semibold text-ink-950 transition-colors hover:bg-gold-400 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Parse transactions
      </button>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
    </div>
  )
}
