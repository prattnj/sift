import type { Category, MappingStore, Transaction } from '../types'

const K_CATEGORIES = 'sift.categories'
const K_MAPPINGS = 'sift.mappings'
const K_SESSION = 'sift.session'

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

// First 20: evenly-spaced hues (rainbow). Last 5: grayscale ramp white → black.
export const CATEGORY_PALETTE = [
  ...Array.from({ length: 20 }, (_, i) => hslToHex((i / 20) * 360, 0.72, 0.62)),
  '#ffffff', '#bfbfbf', '#808080', '#404040', '#000000',
]

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

export function defaultCategories(): Category[] {
  const names = [
    'Groceries', 'Dining Out', 'Gas & Fuel', 'Utilities', 'Rent/Mortgage',
    'Entertainment', 'Shopping', 'Subscriptions', 'Health', 'Income',
  ]
  return names.map((name, i) => ({
    id: uid('cat'),
    name,
    color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
  }))
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore quota / private-mode errors */
  }
}

export function loadCategories(): Category[] {
  const cats = read<Category[] | null>(K_CATEGORIES, null)
  if (cats && cats.length) return cats
  const seeded = defaultCategories()
  write(K_CATEGORIES, seeded)
  return seeded
}

export function saveCategories(cats: Category[]): void {
  write(K_CATEGORIES, cats)
}

export function newCategory(name: string, existing: Category[]): Category {
  return {
    id: uid('cat'),
    name: name.trim(),
    color: CATEGORY_PALETTE[existing.length % CATEGORY_PALETTE.length],
  }
}

export function loadMappings(): MappingStore {
  return read<MappingStore>(K_MAPPINGS, {})
}

export function saveMappings(store: MappingStore): void {
  write(K_MAPPINGS, store)
}

/** Record (or reinforce) that a merchant key belongs to a category. */
export function learnMapping(store: MappingStore, key: string, categoryId: string): MappingStore {
  if (!key) return store
  const prev = store[key]
  const next: MappingStore = {
    ...store,
    [key]: {
      merchantKey: key,
      categoryId,
      count: prev && prev.categoryId === categoryId ? prev.count + 1 : 1,
      updatedAt: Date.now(),
    },
  }
  saveMappings(next)
  return next
}

/** Remove learned mappings that point at a deleted category. */
export function pruneMappings(store: MappingStore, deletedCategoryId: string): MappingStore {
  const next: MappingStore = {}
  for (const [k, v] of Object.entries(store)) {
    if (v.categoryId !== deletedCategoryId) next[k] = v
  }
  saveMappings(next)
  return next
}

export interface SessionState {
  transactions: Transaction[]
  index: number
  fileName: string
}

export function loadSession(): SessionState | null {
  return read<SessionState | null>(K_SESSION, null)
}

export function saveSession(state: SessionState | null): void {
  if (state === null) {
    localStorage.removeItem(K_SESSION)
    return
  }
  write(K_SESSION, state)
}
