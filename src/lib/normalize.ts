import type { CardType, MappingStore } from '../types'

// Tokens/patterns that are transaction-specific noise, not part of the merchant identity.
const DATE_CUT = /\bdate\b/i // everything from a "Date ..." marker onward is noise

/**
 * Turn a raw bank Memo into a clean, human-friendly merchant name for display.
 * Keeps the leading merchant text, drops the trailing reference/date/MCC junk.
 */
export function cleanMerchantName(memo: string): string {
  let s = (memo || '').replace(/\s+/g, ' ').trim()
  // Cut everything from the first "Date" marker (bank appends "Date 07/20/26 <ref>...").
  const dateIdx = s.search(DATE_CUT)
  if (dateIdx > 3) s = s.slice(0, dateIdx)
  // Drop trailing "%% MCC ####" style tails if they survived.
  s = s.replace(/%+.*$/g, '')
  s = s.replace(/\bMCC\b.*$/i, '')
  // Drop long digit/reference runs.
  s = s.replace(/\b[\d]{5,}\b/g, ' ')
  // Collapse and title-ish trim.
  s = s.replace(/\s+/g, ' ').trim()
  return s || (memo || '').trim() || 'Unknown'
}

const STATE_ABBR = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
])

/**
 * Build a normalized matching key from a raw memo. Deterministic and aggressive:
 * strips URLs, digit/reference runs, punctuation, trailing state codes, and MCC noise
 * so the same merchant maps to the same key across statements.
 */
export function merchantKey(memo: string): string {
  let s = cleanMerchantName(memo).toUpperCase()
  // Remove URLs / web fragments.
  s = s.replace(/\bWWW\.[^\s]+/g, ' ')
  s = s.replace(/\b[^\s]+\.(COM|NET|ORG|GOV|CO|IO)\b/g, ' ')
  // Remove punctuation.
  s = s.replace(/[^A-Z0-9\s]/g, ' ')
  // Tokenize; drop numeric-ish reference tokens and lone digits.
  let tokens = s.split(/\s+/).filter(Boolean).filter((t) => {
    if (/\d/.test(t)) return false // any token containing digits is a reference/store number
    if (t === 'MCC') return false
    return true
  })
  // Drop a trailing state abbreviation (e.g. "... UT").
  if (tokens.length > 1 && STATE_ABBR.has(tokens[tokens.length - 1])) {
    tokens = tokens.slice(0, -1)
  }
  // Keep the leading, most-identifying tokens.
  tokens = tokens.slice(0, 5)
  return tokens.join(' ')
}

/** Character bigram set for a string. */
function bigrams(s: string): Set<string> {
  const out = new Set<string>()
  const clean = s.replace(/\s+/g, '')
  for (let i = 0; i < clean.length - 1; i++) out.add(clean.slice(i, i + 2))
  return out
}

/** Sørensen–Dice coefficient over character bigrams (0..1). */
function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0
  const A = bigrams(a)
  const B = bigrams(b)
  let overlap = 0
  for (const g of A) if (B.has(g)) overlap++
  return (2 * overlap) / (A.size + B.size)
}

/** Token-set overlap (Jaccard) — robust to token reordering. */
function tokenJaccard(a: string, b: string): number {
  const A = new Set(a.split(' ').filter(Boolean))
  const B = new Set(b.split(' ').filter(Boolean))
  if (A.size === 0 || B.size === 0) return 0
  let inter = 0
  for (const t of A) if (B.has(t)) inter++
  const union = A.size + B.size - inter
  return inter / union
}

export function similarity(a: string, b: string): number {
  // Blend char-bigram and token overlap; favor whichever is stronger.
  const d = diceCoefficient(a, b)
  const j = tokenJaccard(a, b)
  return Math.max(d, j) * 0.65 + Math.min(d, j) * 0.35
}

export interface MatchResult {
  categoryId: string
  confidence: number
  matchedKey: string
}

const MATCH_THRESHOLD = 0.82

/**
 * Find the best learned category for a merchant key on a specific card.
 * Matching is scoped to the same card: exact key match wins; otherwise fuzzy-match
 * against known keys for that card above a threshold.
 */
export function findBestMatch(card: CardType, key: string, store: MappingStore): MatchResult | null {
  if (!key) return null
  const exact = store[`${card}::${key}`]
  if (exact) return { categoryId: exact.categoryId, confidence: 1, matchedKey: key }

  let best: MatchResult | null = null
  for (const m of Object.values(store)) {
    if (m.card !== card) continue
    const score = similarity(key, m.merchantKey)
    if (score >= MATCH_THRESHOLD && (!best || score > best.confidence)) {
      best = { categoryId: m.categoryId, confidence: score, matchedKey: m.merchantKey }
    }
  }
  return best
}
