import type { CardType, Transaction } from '../types'
import { cleanMerchantName, merchantKey } from './normalize'
import { IGNORED_CATEGORY_ID } from './storage'

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

const HEADER_ALIASES: Record<string, Exclude<keyof HeaderMap, 'card'>> = {
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
  card: CardType
}

const REQUIRED: (keyof HeaderMap)[] = ['date', 'memo', 'amountDebit', 'amountCredit']

// Columns unique to the credit-card export format. Their presence marks a credit-card file.
const CREDIT_CARD_MARKERS = ['fees', 'principal', 'interest']

/** Detect whether a parsed row is the header row and, if so, build a column map. */
function tryBuildHeaderMap(fields: string[]): HeaderMap | null {
  const map: Partial<HeaderMap> = {}
  let creditMarkers = 0
  fields.forEach((f, idx) => {
    const normalized = f.toLowerCase().trim()
    const key = HEADER_ALIASES[normalized]
    if (key !== undefined && map[key] === undefined) map[key] = idx
    if (CREDIT_CARD_MARKERS.includes(normalized)) creditMarkers++
  })
  for (const r of REQUIRED) {
    if (r === 'card') continue
    if (map[r] === undefined) return null
  }
  map.card = creditMarkers > 0 ? 'credit' : 'debit'
  return map as HeaderMap
}

function parseAmount(raw: string): number {
  if (!raw) return NaN
  const cleaned = raw.replace(/[$,\s]/g, '').replace(/[()]/g, '')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : NaN
}

/**
 * Chase credit-card export:
 * Transaction Date,Post Date,Description,Category,Type,Amount,Memo
 * A single signed Amount column (negative = purchase, positive = payment/refund);
 * the merchant lives in Description. Chase's own Category column is ignored.
 */
interface ChaseHeaderMap {
  date: number
  description: number
  amount: number
  type: number | undefined
}

function tryBuildChaseHeaderMap(fields: string[]): ChaseHeaderMap | null {
  const norm = fields.map((f) => f.toLowerCase().trim())
  const idx = (name: string) => {
    const i = norm.indexOf(name)
    return i === -1 ? undefined : i
  }
  const date = idx('transaction date')
  const description = idx('description')
  const amount = idx('amount')
  if (date === undefined || description === undefined || amount === undefined) return null
  return { date, description, amount, type: idx('type') }
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

function parseChaseRow(
  fields: string[],
  header: ChaseHeaderMap,
  lineNo: number,
  errors: string[],
): Transaction | null {
  const get = (idx: number | undefined) => (idx === undefined ? '' : (fields[idx] ?? '').trim())
  const date = get(header.date)
  const merchant = get(header.description)
  const amountRaw = get(header.amount)
  const chaseType = get(header.type)

  if (!amountRaw) {
    if (merchant || date) errors.push(`Line ${lineNo}: no amount found, skipped.`)
    return null
  }
  const signed = parseAmount(amountRaw)
  if (Number.isNaN(signed)) {
    errors.push(`Line ${lineNo}: unparseable amount, skipped.`)
    return null
  }

  const isPayment = chaseType.toLowerCase() === 'payment'
  return {
    id: nextId(),
    transactionNumber: '',
    date,
    description: chaseType,
    memo: merchant,
    merchantName: cleanMerchantName(merchant),
    merchantKey: merchantKey(merchant),
    amount: Math.abs(signed),
    type: signed < 0 ? 'debit' : 'credit',
    card: 'chase',
    balance: null,
    checkNumber: '',
    // Card payments are just money moving between accounts — auto-ignore them.
    categoryId: isPayment ? IGNORED_CATEGORY_ID : null,
    autoSuggested: isPayment,
  }
}

/**
 * Parse a full bank CSV export. Skips leading title/filter lines until the header
 * row is detected, then reads transactions. Supports the bank's debit/credit export
 * (separate debit and credit columns) and the Chase export (single signed amount).
 */
export function parseCsv(text: string): ParseResult {
  const rawLines = text.split(/\r\n|\n|\r/)
  const errors: string[] = []
  let header: HeaderMap | null = null
  let chaseHeader: ChaseHeaderMap | null = null
  let skippedLines = 0
  const transactions: Transaction[] = []

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]
    if (line.trim() === '') continue
    const fields = parseCsvLine(line)

    if (chaseHeader) {
      const txn = parseChaseRow(fields, chaseHeader, i + 1, errors)
      if (txn) transactions.push(txn)
      continue
    }

    if (!header) {
      const maybe = tryBuildHeaderMap(fields)
      if (maybe) {
        header = maybe
      } else {
        chaseHeader = tryBuildChaseHeaderMap(fields)
        if (!chaseHeader) skippedLines++
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
      card: header.card,
      balance: Number.isNaN(balance) ? null : balance,
      checkNumber: get(header.checkNumber),
      categoryId: null,
      autoSuggested: false,
    })
  }

  if (!header && !chaseHeader) {
    errors.push(
      'Could not find a header row. Expected columns like "Date", "Memo", "Amount Debit", "Amount Credit" (bank) or "Transaction Date", "Description", "Amount" (Chase).',
    )
  }

  return { transactions, skippedLines, errors }
}
