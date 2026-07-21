import type { Transaction } from '../types'
import { cleanMerchantName, merchantKey } from './normalize'

/** Parse a single CSV line into fields, honoring double-quoted fields with embedded commas. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      fields.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  fields.push(cur)
  return fields.map((f) => f.trim())
}

const HEADER_ALIASES: Record<string, keyof HeaderMap> = {
  'transaction number': 'transactionNumber',
  date: 'date',
  description: 'description',
  memo: 'memo',
  'amount debit': 'amountDebit',
  'amount credit': 'amountCredit',
  balance: 'balance',
  'check number': 'checkNumber',
}

interface HeaderMap {
  transactionNumber: number
  date: number
  description: number
  memo: number
  amountDebit: number
  amountCredit: number
  balance: number
  checkNumber: number
}

const REQUIRED: (keyof HeaderMap)[] = ['date', 'memo', 'amountDebit', 'amountCredit']

/** Detect whether a parsed row is the header row and, if so, build a column map. */
function tryBuildHeaderMap(fields: string[]): HeaderMap | null {
  const map: Partial<HeaderMap> = {}
  fields.forEach((f, idx) => {
    const key = HEADER_ALIASES[f.toLowerCase().trim()]
    if (key !== undefined && map[key] === undefined) map[key] = idx
  })
  for (const r of REQUIRED) {
    if (map[r] === undefined) return null
  }
  return map as HeaderMap
}

function parseAmount(raw: string): number {
  if (!raw) return NaN
  const cleaned = raw.replace(/[$,\s]/g, '').replace(/[()]/g, '')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : NaN
}

export interface ParseResult {
  transactions: Transaction[]
  skippedLines: number
  errors: string[]
}

let idCounter = 0
function nextId(): string {
  idCounter++
  return `txn_${Date.now().toString(36)}_${idCounter}`
}

/**
 * Parse a full bank CSV export. Skips leading title/filter lines until the header
 * row is detected, then reads transactions. Debits and credits live in separate columns.
 */
export function parseCsv(text: string): ParseResult {
  const rawLines = text.split(/\r\n|\n|\r/)
  const errors: string[] = []
  let header: HeaderMap | null = null
  let skippedLines = 0
  const transactions: Transaction[] = []

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]
    if (line.trim() === '') continue
    const fields = parseCsvLine(line)

    if (!header) {
      const maybe = tryBuildHeaderMap(fields)
      if (maybe) {
        header = maybe
      } else {
        skippedLines++
      }
      continue
    }

    const get = (idx: number | undefined) => (idx === undefined ? '' : (fields[idx] ?? '').trim())

    const date = get(header.date)
    const memo = get(header.memo)
    const debitRaw = get(header.amountDebit)
    const creditRaw = get(header.amountCredit)

    // Skip rows that carry no amount at all (blank/trailing lines).
    if (!debitRaw && !creditRaw) {
      if (memo || date) errors.push(`Line ${i + 1}: no amount found, skipped.`)
      continue
    }

    const debit = parseAmount(debitRaw)
    const credit = parseAmount(creditRaw)

    let amount: number
    let type: Transaction['type']
    if (!Number.isNaN(debit) && debitRaw) {
      amount = Math.abs(debit)
      type = 'debit'
    } else if (!Number.isNaN(credit) && creditRaw) {
      amount = Math.abs(credit)
      type = 'credit'
    } else {
      errors.push(`Line ${i + 1}: unparseable amount, skipped.`)
      continue
    }

    const balance = parseAmount(get(header.balance))

    transactions.push({
      id: nextId(),
      transactionNumber: get(header.transactionNumber),
      date,
      description: get(header.description),
      memo,
      merchantName: cleanMerchantName(memo),
      merchantKey: merchantKey(memo),
      amount,
      type,
      balance: Number.isNaN(balance) ? null : balance,
      checkNumber: get(header.checkNumber),
      categoryId: null,
      autoSuggested: false,
    })
  }

  if (!header) {
    errors.push('Could not find a header row. Expected columns like "Date", "Memo", "Amount Debit", "Amount Credit".')
  }

  return { transactions, skippedLines, errors }
}
