import type { TileCode } from "./tiles"

export type YakuCategory = "menzen-only" | "kuisagari" | "misc" | "yakuman"

export type HanValue =
  | { kind: "han"; closed: number | null; open: number | null }
  | { kind: "yakuman"; rank: 1 | 2 }

export type Example =
  | {
      tiles: TileCode[]
      descriptionKey?: string
    }
  | {
      // 牌姿短縮表記（手牌+風露）を用いた例示
      // 例: "s123m222s44_,z111-,z2222"
      notation: string
      descriptionKey?: string
    }

export type Yaku = {
  id: string
  nameKey: string
  aliases: string[]
  category: YakuCategory
  value: HanValue
  notesKey?: string
  examples?: Example[]
  ruleFlags?: {
    doubleYakuman?: boolean
    nagashiMangan?: boolean
  }
}

export type RuleSet = {
  openTanyao: false
  doubleYakuman: true
  nagashiMangan: true
  kazoeYakuman: false
}

export const defaultRuleSet: RuleSet = {
  openTanyao: false,
  doubleYakuman: true,
  nagashiMangan: true,
  kazoeYakuman: false,
}
