export type TxnType = 'debit' | 'credit'

export interface Transaction {
  id: string
  transactionNumber: string
  date: string // MM/DD/YYYY as given
  description: string // generic bank description, e.g. "Withdrawal Debit Card"
  memo: string // raw merchant text
  merchantName: string // cleaned, human-friendly display name
  merchantKey: string // normalized key used for matching/learning
  amount: number // absolute value, always positive
  type: TxnType
  balance: number | null
  checkNumber: string
  categoryId: string | null
  autoSuggested: boolean // true if the current categoryId came from a learned mapping
}

export interface Category {
  id: string
  name: string
  color: string // hex accent for the chip
}

export interface Mapping {
  merchantKey: string
  categoryId: string
  count: number
  updatedAt: number
}

export type MappingStore = Record<string, Mapping>
