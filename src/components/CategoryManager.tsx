import { useState } from 'react'
import type { Category } from '../types'
import { CATEGORY_PALETTE, newCategory } from '../lib/storage'

interface Props {
  categories: Category[]
  onChange: (cats: Category[]) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export default function CategoryManager({ categories, onChange, onDelete, onClose }: Props) {
  const [name, setName] = useState('')

  const add = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setName('')
      return
    }
    onChange([...categories, newCategory(trimmed, categories)])
    setName('')
  }

  const rename = (id: string, value: string) =>
    onChange(categories.map((c) => (c.id === id ? { ...c, name: value } : c)))

  const recolor = (id: string, color: string) =>
    onChange(categories.map((c) => (c.id === id ? { ...c, color } : c)))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="card gold-glow-sm w-full max-w-lg max-h-[85vh] flex flex-col animate-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-ink-700">
          <h2 className="text-lg font-semibold gold-text">Manage Categories</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-gold-400 transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex gap-2 p-5 border-b border-ink-700">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="New category name…"
            className="flex-1 bg-ink-900 border border-ink-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-gold-500 focus:gold-glow-sm transition-all"
          />
          <button
            onClick={add}
            className="px-4 py-2 rounded-lg bg-gold-500 text-ink-950 font-semibold text-sm hover:bg-gold-400 transition-colors"
          >
            Add
          </button>
        </div>

        <div className="overflow-y-auto p-3 space-y-1">
          {categories.length === 0 && (
            <p className="text-center text-slate-500 text-sm py-6">No categories yet.</p>
          )}
          {categories.map((c) => (
            <div
              key={c.id}
              className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-ink-800 transition-colors"
            >
              <ColorDot color={c.color} onPick={(col) => recolor(c.id, col)} />
              <input
                value={c.name}
                onChange={(e) => rename(c.id, e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none border-b border-transparent focus:border-ink-600 py-1"
              />
              <button
                onClick={() => onDelete(c.id)}
                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all text-sm px-2"
                title="Delete category"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ColorDot({ color, onPick }: { color: string; onPick: (c: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="h-5 w-5 rounded-full ring-1 ring-white/10 shrink-0"
        style={{ backgroundColor: color }}
        title="Change color"
      />
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute z-20 mt-2 p-3 card gold-glow-sm"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1.5rem)', gap: '0.5rem' }}
          >
            {CATEGORY_PALETTE.map((col) => {
              const active = col.toLowerCase() === color.toLowerCase()
              return (
                <button
                  key={col}
                  onClick={() => {
                    onPick(col)
                    setOpen(false)
                  }}
                  className={`h-6 w-6 shrink-0 rounded-full transition-transform hover:scale-110 ${
                    active ? 'ring-2 ring-white ring-offset-2 ring-offset-ink-800' : 'ring-1 ring-white/10'
                  }`}
                  style={{ backgroundColor: col }}
                  title={col}
                />
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
