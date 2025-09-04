"use client"

import { t } from "@/lib/i18n"
import type { Yaku } from "@/lib/mahjong/yaku"
import { TileGroup } from "@/components/tiles/TileGroup"

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
        {yaku.examples?.[0]?.tiles && (
          <TileGroup codes={yaku.examples[0].tiles} size="sm" />
        )}
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
