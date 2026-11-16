import type { CardType } from '../types'

interface CardMeta {
  label: string // full badge label, e.g. "Credit Card"
  short: string // compact label for dense lists
  badgeClass: string
}

export const CARD_META: Record<CardType, CardMeta> = {
  debit: { label: 'Debit Card', short: 'Debit', badgeClass: 'bg-sky-500/15 text-sky-300' },
  credit: { label: 'Credit Card', short: 'Credit', badgeClass: 'bg-violet-500/15 text-violet-300' },
  chase: { label: 'Chase Sapphire', short: 'Sapphire', badgeClass: 'bg-blue-500/20 text-blue-300' },
}
