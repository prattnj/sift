export type TxnType = 'debit' | 'credit'

/** Which physical card/account a file came from — derived from the CSV format. */
export type CardType = 'debit' | 'credit' | 'chase'

export interface Transaction {
  id: string
  transactionNumber: string
  date: string // MM/DD/YYYY as given
  description: string // generic bank description, e.g. "Withdrawal Debit Card"
  memo: string // raw merchant text
  merchantName: string // cleaned, human-friendly display name
  merchantKey: string // normalized key used for matching/learning
  amount: number // absolute value, always positive
  type: TxnType // money direction: debit = out, credit = in
  card: CardType // which card/account this transaction was made on
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
  card: CardType // mappings are scoped per card
  categoryId: string
  count: number
  updatedAt: number
}

export type MappingStore = Record<string, Mapping>

