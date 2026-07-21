import { useCallback, useEffect, useState } from 'react'
import type { Category, MappingStore, Transaction } from './types'
import {
  loadCategories,
  loadMappings,
  loadSession,
  saveCategories,
  saveSession,
  learnMapping,
  pruneMappings,
} from './lib/storage'
import { findBestMatch } from './lib/normalize'
import UploadView from './components/UploadView'
import CategorizeView from './components/CategorizeView'
import SummaryView from './components/SummaryView'
import CategoryManager from './components/CategoryManager'

type View = 'upload' | 'categorize' | 'summary'

export default function App() {
  const [categories, setCategories] = useState<Category[]>(() => loadCategories())
  const [mappings, setMappings] = useState<MappingStore>(() => loadMappings())
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [index, setIndex] = useState(0)
  const [fileName, setFileName] = useState('')
  const [view, setView] = useState<View>('upload')
  const [showManager, setShowManager] = useState(false)
  const [restored, setRestored] = useState<ReturnType<typeof loadSession>>(null)

  // Detect a resumable session on first mount.
  useEffect(() => {
    const s = loadSession()
    if (s && s.transactions.length) setRestored(s)
  }, [])

  // Persist the in-progress session whenever it changes.
  useEffect(() => {
    if (view !== 'upload' && transactions.length) {
      saveSession({ transactions, index, fileName })
    }
  }, [transactions, index, fileName, view])

  const persistCategories = useCallback((cats: Category[]) => {
    setCategories(cats)
    saveCategories(cats)
  }, [])

  const handleLoaded = useCallback(
    (txns: Transaction[], name: string) => {
      // Apply learned auto-suggestions up front.
      const suggested = txns.map((t) => {
        const match = findBestMatch(t.merchantKey, mappings)
        return match ? { ...t, categoryId: match.categoryId, autoSuggested: true } : t
      })
      setTransactions(suggested)
      setFileName(name)
      setIndex(0)
      setView('categorize')
      setRestored(null)
    },
    [mappings],
  )

  const resume = useCallback(() => {
    if (!restored) return
    setTransactions(restored.transactions)
    setIndex(restored.index)
    setFileName(restored.fileName)
    setView('categorize')
    setRestored(null)
  }, [restored])

  const assign = useCallback(
    (categoryId: string, remember = true) => {
      const cur = transactions[index]
      if (!cur) return
      // Reinforce the learned mapping for this merchant (unless the user opted out).
      const updated = remember ? learnMapping(mappings, cur.merchantKey, categoryId) : mappings
      if (remember) setMappings(updated)

      setTransactions((prev) => {
        const target = prev[index]
        if (!target) return prev
        return prev.map((t, i) => {
          if (i === index) return { ...t, categoryId, autoSuggested: false }
          // Propagate the fresh knowledge to any still-uncategorized transactions
          // (e.g. an identical merchant later in this same file).
          if (!t.categoryId) {
            const match = findBestMatch(t.merchantKey, updated)
            if (match) return { ...t, categoryId: match.categoryId, autoSuggested: true }
          }
          return t
        })
      })

      // Advance to the next transaction.
      setIndex((i) => Math.min(i + 1, transactions.length - 1))
    },
    [index, transactions, mappings],
  )

  const clear = useCallback(() => {
    setTransactions((prev) => {
      const cur = prev[index]
      if (!cur) return prev
      const next = prev.slice()
      next[index] = { ...cur, categoryId: null, autoSuggested: false }
      return next
    })
  }, [index])

  const deleteCategory = useCallback(
    (id: string) => {
      persistCategories(categories.filter((c) => c.id !== id))
      setMappings(pruneMappings(mappings, id))
      setTransactions((prev) =>
        prev.map((t) => (t.categoryId === id ? { ...t, categoryId: null, autoSuggested: false } : t)),
      )
    },
    [categories, mappings, persistCategories],
  )

  const startOver = useCallback(() => {
    saveSession(null)
    setTransactions([])
    setIndex(0)
    setFileName('')
    setView('upload')
    setRestored(null)
  }, [])

  return (
    <div className="min-h-full">
      <Header
        fileName={view !== 'upload' ? fileName : undefined}
        onManage={() => setShowManager(true)}
        onHome={view !== 'upload' ? startOver : undefined}
      />

      <main>
        {view === 'upload' && (
          <UploadView onLoaded={handleLoaded} hasSession={!!restored} onResume={resume} />
        )}
        {view === 'categorize' && (
          <CategorizeView
            transactions={transactions}
            index={index}
            categories={categories}
            onAssign={assign}
            onClear={clear}
            onNavigate={setIndex}
            onManageCategories={() => setShowManager(true)}
            onFinish={() => setView('summary')}
          />
        )}
        {view === 'summary' && (
          <SummaryView
            transactions={transactions}
            categories={categories}
            onBack={() => setView('categorize')}
            onStartOver={startOver}
          />
        )}
      </main>

      {showManager && (
        <CategoryManager
          categories={categories}
          onChange={persistCategories}
          onDelete={deleteCategory}
          onClose={() => setShowManager(false)}
        />
      )}
    </div>
  )
}

function Header({
  fileName,
  onManage,
  onHome,
}: {
  fileName?: string
  onManage: () => void
  onHome?: () => void
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-ink-800/80 bg-ink-950/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <button onClick={onHome} className="flex items-center gap-2.5" disabled={!onHome}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 text-ink-950 gold-glow-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 7h16M7 12h10M10 17h4"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="text-left leading-tight">
            <div className="text-lg font-bold tracking-tight gold-text">Sift</div>
          </div>
        </button>

        <div className="flex items-center gap-4">
          {fileName && (
            <span className="hidden sm:inline max-w-[220px] truncate text-xs text-slate-500">
              {fileName}
            </span>
          )}
          <button
            onClick={onManage}
            className="rounded-lg border border-ink-700 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:border-gold-600/60 hover:text-gold-400"
          >
            Categories
          </button>
        </div>
      </div>
    </header>
  )
}
