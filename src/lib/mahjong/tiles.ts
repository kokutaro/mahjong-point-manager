export type TileSuit = "m" | "p" | "s" | "z"
export type TileCode =
  | `${"m" | "p" | "s"}${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`
  | `${"m" | "p" | "s"}5r`
  | `z${1 | 2 | 3 | 4 | 5 | 6 | 7}`

const MAP_WINDS = ["\u{1F000}", "\u{1F001}", "\u{1F002}", "\u{1F003}"] // 東南西北
const MAP_DRAGONS = ["\u{1F006}", "\u{1F005}", "\u{1F004}"] // 白發中

export function tileToUnicode(code: TileCode): string {
  const suit = code[0] as TileSuit
  if (suit === "z") {
    const n = Number(code.slice(1))
    if (n >= 1 && n <= 4) return MAP_WINDS[n - 1]
    if (n === 5) return MAP_DRAGONS[0]
    if (n === 6) return MAP_DRAGONS[1]
    if (n === 7) return MAP_DRAGONS[2]
  } else {
    const n = Number(code[1])
    if (suit === "m") return String.fromCodePoint(0x1f006 + n) // 1->0x1F007 .. 9->0x1F00F
    if (suit === "s") return String.fromCodePoint(0x1f00f + n) // 1->0x1F010 .. 9->0x1F018
    if (suit === "p") return String.fromCodePoint(0x1f018 + n) // 1->0x1F019 .. 9->0x1F021
  }
  return "🀫" // fallback (unknown)
}

export function tileAriaLabel(code: TileCode): string {
  const suit = code[0] as TileSuit
  const isRed = code.endsWith("5r")
  const label = (() => {
    if (suit === "z") {
      const n = Number(code.slice(1))
      return ["東", "南", "西", "北", "白", "發", "中"][n - 1]
    }
    const n = code[1]
    const suitLabel = suit === "m" ? "萬" : suit === "p" ? "筒" : "索"
    const num = ["一", "二", "三", "四", "五", "六", "七", "八", "九"][
      Number(n) - 1
    ]
    return `${num}${suitLabel}`
  })()
  return isRed ? `${label} 赤` : label
}

/**
 * 牌コードから画像パスを返す
 * - 数牌: /img/pai/{m|p|s}_{1-9}.gif
 * - 字牌: /img/pai/z_{1-7}.gif （1:東,2:南,3:西,4:北,5:白,6:發,7:中）
 * - 赤5: 通常の5画像を使用（UI側で赤マーカー）
 */
export function tileToImageSrc(code: TileCode): string {
  const suit = code[0] as TileSuit
  if (suit === "z") {
    const n = Number(code.slice(1))
    return `/img/pai/z_${n}.gif`
  }
  const n = code.endsWith("5r") ? 5 : Number(code[1])
  return `/img/pai/${suit}_${n}.gif`
}
