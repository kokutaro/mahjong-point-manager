"use client"

import { useMemo, useState } from "react"
import {
  parseHandNotation,
  formatHandNotation,
} from "@/lib/mahjong/hand-notation"
import type { ParsedHand, Meld } from "@/lib/mahjong/hand-notation"
import TileGroup from "@/components/tiles/TileGroup"
import Tile from "@/components/tiles/Tile"
import MeldTiles from "@/components/tiles/MeldTiles"

function MeldView({ meld }: { meld: Meld }) {
  const label =
    meld.kind === "chi" ? "チー" : meld.kind === "pon" ? "ポン" : "カン"
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs rounded bg-blue-50 px-1 py-0.5 border border-blue-200">
        {label}
      </span>
      <MeldTiles meld={meld} />
      <span className="text-xs text-gray-500">
        {meld.kind === "kan" ? meld.subtype : `from: ${meld.from}`}
      </span>
    </div>
  )
}

export default function HandNotationDemoPage() {
  const [input, setInput] = useState("s123m222s44_,z111-,z2222")
  const [error, setError] = useState<string>("")

  const parsed: ParsedHand | null = useMemo(() => {
    try {
      setError("")
      return parseHandNotation(input)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return null
    }
  }, [input])

  const formatted = useMemo(() => {
    if (!parsed) return ""
    try {
      return formatHandNotation(parsed)
    } catch {
      return ""
    }
  }, [parsed])

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <h1 className="text-xl font-semibold">牌姿短縮表記デモ</h1>
      <p className="text-sm text-gray-600">
        m/p/s/z + 数字列、鳴きはカンマ区切り、ツモは手牌末尾の _ で表現（例:
        s123m222s44_,z111-,z2222）
      </p>

      <div className="space-y-2">
        <label htmlFor="hand-input" className="text-sm font-medium">
          入力
        </label>
        <input
          id="hand-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full rounded border px-3 py-2 text-sm"
          placeholder="例: s123m222s44_,z111-,z2222"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {parsed && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold">手牌</h2>
            <div className="flex items-center gap-3">
              <TileGroup codes={parsed.concealed} />
              {parsed.tsumo && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">ツモ</span>
                  <Tile code={parsed.tsumo} />
                </div>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-base font-semibold">鳴き</h2>
            <div className="flex flex-col gap-2">
              {parsed.melds.length === 0 ? (
                <p className="text-sm text-gray-500">なし</p>
              ) : (
                parsed.melds.map((m, i) => <MeldView key={i} meld={m} />)
              )}
            </div>
          </div>

          <div>
            <h2 className="text-base font-semibold">整形表記</h2>
            <code className="text-sm bg-gray-50 px-2 py-1 rounded border">
              {formatted}
            </code>
          </div>
        </div>
      )}
    </div>
  )
}
