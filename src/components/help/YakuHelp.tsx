"use client"

import { RuleLegend } from "@/components/yaku/RuleLegend"
import { YakuTable } from "@/components/yaku/YakuTable"
import { yakuJa } from "@/data/yaku/ja"
import { t } from "@/lib/i18n"

type Props = {
  locale?: string
}

export function YakuHelp({ locale = "ja" }: Props) {
  return (
    <div className="w-full">
      <h2 className="text-xl font-semibold mb-2">{t("help.title", locale)}</h2>
      <div className="mb-3">
        <RuleLegend locale={locale} />
      </div>
      <YakuTable data={yakuJa} locale={locale} />
    </div>
  )
}

export default YakuHelp
