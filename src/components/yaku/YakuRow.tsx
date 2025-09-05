"use client"

import { t } from "@/lib/i18n"
import type { Example, Yaku } from "@/lib/mahjong/yaku"
import { TileGroup } from "@/components/tiles/TileGroup"
import { parseHandNotation } from "@/lib/mahjong/hand-notation"
import MeldTiles from "@/components/tiles/MeldTiles"

type Props = {
  yaku: Yaku
  locale?: string
}

function HanBadge({ yaku, locale = "ja" }: { yaku: Yaku; locale?: string }) {
  if (yaku.value.kind === "yakuman") {
    const label =
      yaku.value.rank === 2
        ? `${t("ui.double", locale)}${t("ui.yakuman", locale)}`
        : t("ui.yakuman", locale)
    return (
      <span className="text-white bg-purple-600 text-xs px-2 py-1 rounded">
        {label}
      </span>
    )
  }
  const { closed, open } = yaku.value
  return (
    <div className="flex items-center gap-1 text-xs text-gray-700">
      {closed != null && (
        <span className="rounded bg-green-100 text-green-800 px-1 py-0.5">
          {t("ui.closed", locale)} {closed}
        </span>
      )}
      {open != null && (
        <span className="rounded bg-blue-100 text-blue-800 px-1 py-0.5">
          {t("ui.open", locale)} {open}
        </span>
      )}
    </div>
  )
}

export function YakuRow({ yaku, locale = "ja" }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center py-2 border-b border-gray-100">
      <div className="font-medium text-gray-900">{t(yaku.nameKey, locale)}</div>
      <div>
        <HanBadge yaku={yaku} locale={locale} />
      </div>
      <div className="sm:col-span-2">
        {(() => {
          const ex = yaku.examples?.[0] as Example | undefined
          if (!ex) return null
          if ("notation" in ex && ex.notation) {
            try {
              const parsed = parseHandNotation(ex.notation)
              return (
                <div className="flex items-center gap-3">
                  <TileGroup codes={parsed.concealed} size="sm" />
                  {parsed.tsumo && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">ツモ</span>
                      <TileGroup codes={[parsed.tsumo]} size="sm" />
                    </div>
                  )}
                  {parsed.melds.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">|</span>
                      {parsed.melds.map((m, i) => (
                        <MeldTiles key={i} meld={m} />
                      ))}
                    </div>
                  )}
                </div>
              )
            } catch {
              // フォールバック: 何もしない
            }
          }
          if ("tiles" in ex && ex.tiles) {
            return <TileGroup codes={ex.tiles} size="sm" />
          }
          return null
        })()}
        {yaku.notesKey && (
          <div className="text-xs text-gray-500 mt-1">
            {t(yaku.notesKey, locale)}
          </div>
        )}
      </div>
    </div>
  )
}

export default YakuRow
