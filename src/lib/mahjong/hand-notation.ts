import type { TileCode, TileSuit } from "./tiles"

export type NumberSuit = "m" | "p" | "s"

export type CallFrom = "shimo" | "toimen" | "kami"
export type CallFromSymbol = "-" | "=" | "+"

export type KanSubtype = "closed" | "open" | "added"

export type Meld =
  | {
      kind: "chi"
      suit: NumberSuit
      tiles: readonly [TileCode, TileCode, TileCode]
      from: CallFrom
      // チーで鳴いた牌（記法上は方向記号直前の数字）
      called?: TileCode
    }
  | {
      kind: "pon"
      suit: TileSuit
      tiles: readonly [TileCode, TileCode, TileCode]
      from: CallFrom
    }
  | {
      kind: "kan"
      suit: TileSuit
      tiles: readonly [TileCode, TileCode, TileCode, TileCode]
      subtype: KanSubtype
      from?: CallFrom
    }

export type ParsedHand = {
  concealed: TileCode[]
  tsumo?: TileCode
  melds: Meld[]
}

export function mapCallFromSymbol(sym: CallFromSymbol): CallFrom {
  switch (sym) {
    case "-":
      return "shimo"
    case "=":
      return "toimen"
    case "+":
      return "kami"
  }
}

function isNumberSuit(s: string): s is NumberSuit {
  return s === "m" || s === "p" || s === "s"
}

function isTileSuit(s: string): s is TileSuit {
  return s === "m" || s === "p" || s === "s" || s === "z"
}

function makeTile(suit: TileSuit, n: number): TileCode {
  if (suit === "z") {
    if (n < 1 || n > 7) throw new Error("invalid honor number")
    return `z${n}` as TileCode
  }
  if (n < 1 || n > 9) throw new Error("invalid number tile")
  return `${suit}${n}` as TileCode
}

function parseMeldBlock(block: string): Meld {
  if (block.length < 2) throw new Error("invalid meld block")
  const suit = block[0]
  if (!isTileSuit(suit)) throw new Error("invalid meld suit")

  const tail = block.slice(1)
  const last = tail[tail.length - 1]
  const isDirectional = last === "-" || last === "=" || last === "+"

  // Added Kan: e.g. s222=2 or s222+2 or s222-2
  // pattern: 3 same digits + direction + same digit
  if (/^[1-9]{3}[-=+][1-9]$/.test(tail)) {
    const body = tail.slice(0, 3)
    const dir = tail[3] as CallFromSymbol
    const add = tail[4]
    if (new Set(body).size === 1 && add === body[0]) {
      const n = Number(body[0])
      const tiles = [
        makeTile(suit as TileSuit, n),
        makeTile(suit as TileSuit, n),
        makeTile(suit as TileSuit, n),
        makeTile(suit as TileSuit, n),
      ] as const
      return {
        kind: "kan",
        suit: suit as TileSuit,
        tiles,
        subtype: "added",
        from: mapCallFromSymbol(dir),
      }
    }
  }

  // Open Kan: s2222= (four of a kind + direction)
  if (isDirectional) {
    const dir = last as CallFromSymbol
    const nums = tail.slice(0, -1)
    if (/^[1-9]{4}$/.test(nums) && new Set(nums).size === 1) {
      const n = Number(nums[0])
      const tiles = [
        makeTile(suit as TileSuit, n),
        makeTile(suit as TileSuit, n),
        makeTile(suit as TileSuit, n),
        makeTile(suit as TileSuit, n),
      ] as const
      return {
        kind: "kan",
        suit: suit as TileSuit,
        tiles,
        subtype: "open",
        from: mapCallFromSymbol(dir),
      }
    }
  }

  // Closed Kan: s2222 or z2222 (no direction)
  if (/^[1-9]{4}$/.test(tail) && new Set(tail).size === 1) {
    const n = Number(tail[0])
    const tiles = [
      makeTile(suit as TileSuit, n),
      makeTile(suit as TileSuit, n),
      makeTile(suit as TileSuit, n),
      makeTile(suit as TileSuit, n),
    ] as const
    return { kind: "kan", suit: suit as TileSuit, tiles, subtype: "closed" }
  }

  // Chi: s123 with direction
  if (
    isNumberSuit(suit) &&
    isDirectional &&
    /^[1-9]{3}$/.test(tail.slice(0, -1))
  ) {
    const dir = last as CallFromSymbol
    const ns = tail.slice(0, -1)
    const a = Number(ns[0])
    const b = Number(ns[1])
    const c = Number(ns[2])
    // 並び順は任意だが、昇順に並べると連続している必要がある
    const sorted = [a, b, c].sort((x, y) => x - y)
    if (sorted[0] + 1 === sorted[1] && sorted[1] + 1 === sorted[2]) {
      const tiles = [
        makeTile(suit as NumberSuit, sorted[0]),
        makeTile(suit as NumberSuit, sorted[1]),
        makeTile(suit as NumberSuit, sorted[2]),
      ] as const
      // 記法上、方向記号直前の数字を「鳴いた牌」とみなす
      const calledDigit = Number(ns[2])
      const called = makeTile(suit as NumberSuit, calledDigit)
      return {
        kind: "chi",
        suit: suit as NumberSuit,
        tiles,
        from: mapCallFromSymbol(dir),
        called,
      }
    }
  }

  // Pon: s222 with direction
  if (isDirectional && /^[1-9]{3}$/.test(tail.slice(0, -1))) {
    const dir = last as CallFromSymbol
    const ns = tail.slice(0, -1)
    if (new Set(ns).size === 1) {
      const n = Number(ns[0])
      const tiles = [
        makeTile(suit as TileSuit, n),
        makeTile(suit as TileSuit, n),
        makeTile(suit as TileSuit, n),
      ] as const
      return {
        kind: "pon",
        suit: suit as TileSuit,
        tiles,
        from: mapCallFromSymbol(dir),
      }
    }
  }

  throw new Error("invalid meld block form")
}

export function parseHandNotation(input: string): ParsedHand {
  if (typeof input !== "string" || input.length === 0)
    throw new Error("empty notation")
  const blocks = input.split(",")
  if (blocks.length === 0) throw new Error("invalid notation")

  const concealed: TileCode[] = []
  let tsumo: TileCode | undefined
  const melds: Meld[] = []

  // parse concealed + tsumo (first block)
  const first = blocks[0]
  if (!first) throw new Error("missing concealed block")
  // find underscore position if any
  const usIndex = first.indexOf("_")
  const concealedStr = usIndex >= 0 ? first.slice(0, usIndex) : first
  if (usIndex >= 0) {
    if (usIndex !== first.length - 1)
      throw new Error("underscore must be at end of first block")
  }
  // parse suits and digits sequentially: e.g. s123m222s44
  let currentSuit: TileSuit | null = null
  for (let i = 0; i < concealedStr.length; i++) {
    const ch = concealedStr[i]
    if (isTileSuit(ch)) {
      currentSuit = ch
      continue
    }
    if (!currentSuit) throw new Error("number before suit in concealed")
    if (ch < "1" || ch > "9") throw new Error("invalid digit in concealed")
    const n = Number(ch)
    concealed.push(makeTile(currentSuit, n))
  }
  if (usIndex >= 0) {
    // tsumo tile is the last digit before '_' within the last suit segment
    // find last suit in concealedStr
    let lastSuit: TileSuit | null = null
    for (let i = 0; i < concealedStr.length; i++) {
      const ch = concealedStr[i]
      if (isTileSuit(ch)) lastSuit = ch
    }
    if (!lastSuit) throw new Error("tsumo requires a suit before underscore")
    // find last digit in concealedStr
    let lastDigit: number | null = null
    for (let i = concealedStr.length - 1; i >= 0; i--) {
      const ch = concealedStr[i]
      if (ch >= "1" && ch <= "9") {
        lastDigit = Number(ch)
        break
      }
      if (isTileSuit(ch)) break
    }
    if (lastDigit === null) throw new Error("tsumo digit not found")
    tsumo = makeTile(lastSuit, lastDigit)
    // remove one instance of tsumo tile from concealed
    const idx = concealed.findIndex((t) => t === tsumo)
    if (idx < 0) throw new Error("tsumo tile not present in concealed")
    concealed.splice(idx, 1)
  }

  // parse melds (if any)
  for (let i = 1; i < blocks.length; i++) {
    const b = blocks[i]
    if (!b) continue
    melds.push(parseMeldBlock(b))
  }

  return { concealed, tsumo, melds }
}

function suitOrderForConcealed(tsumoTile?: TileCode): TileSuit[] {
  const base: TileSuit[] = ["m", "p", "s", "z"]
  if (!tsumoTile) return base
  const suit = tsumoTile[0] as TileSuit
  return base.filter((s) => s !== suit).concat([suit])
}

function digitsForSuit(tiles: TileCode[], suit: TileSuit): string {
  const nums: number[] = []
  for (const t of tiles) {
    if (t[0] === suit) {
      const n = Number(t.slice(1).replace("r", ""))
      nums.push(n)
    }
  }
  nums.sort((a, b) => a - b)
  return nums.join("")
}

function callFromToSymbol(from: CallFrom): CallFromSymbol {
  switch (from) {
    case "shimo":
      return "-"
    case "toimen":
      return "="
    case "kami":
      return "+"
  }
}

export function formatHandNotation(hand: ParsedHand): string {
  const { concealed, tsumo, melds } = hand
  const order = suitOrderForConcealed(tsumo)
  let concealedBlock = ""
  for (const s of order) {
    const digits = digitsForSuit(concealed.concat(tsumo ? [tsumo] : []), s)
    if (digits.length > 0) concealedBlock += s + digits
  }
  if (tsumo) concealedBlock += "_"

  const meldBlocks = melds.map((m) => {
    if (m.kind === "chi") {
      const d = m.tiles.map((t) => Number(t[1] || t.slice(1))).join("")
      return `${m.suit}${d}${callFromToSymbol(m.from)}`
    }
    if (m.kind === "pon") {
      const n = Number(m.tiles[0].slice(1))
      return `${m.suit}${String(n).repeat(3)}${callFromToSymbol(m.from)}`
    }
    // kan
    const n = Number(m.tiles[0].slice(1))
    if (m.subtype === "closed") {
      return `${m.suit}${String(n).repeat(4)}`
    }
    if (m.subtype === "open") {
      return `${m.suit}${String(n).repeat(4)}${callFromToSymbol(m.from!)}`
    }
    // added
    return `${m.suit}${String(n).repeat(3)}${callFromToSymbol(m.from!)}${n}`
  })

  return [concealedBlock, ...meldBlocks].filter(Boolean).join(",")
}
