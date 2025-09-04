// Simple normalization helpers for search
// - NFKC
// - Trim + lowercase for ASCII
// - Katakana -> Hiragana

function toHiragana(input: string): string {
  return input.replace(/[ァ-ン]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  )
}

export function normalizeQuery(input: string): string {
  const nfkc = input.normalize("NFKC").trim()
  const lowered = nfkc.toLowerCase()
  // Convert kana to hiragana for stable matching
  const kana = toHiragana(lowered)
  return kana
}

type MinimalYaku = {
  id: string
  name: string // localized name for current locale
  aliases?: string[]
}

export function yakuMatches(yaku: MinimalYaku, rawQuery: string): boolean {
  const q = normalizeQuery(rawQuery)
  if (!q) return true
  const fields = [yaku.name, ...(yaku.aliases || [])].map(normalizeQuery)
  return fields.some((f) => f.includes(q))
}
