"use client"

import { defaultRuleSet, type RuleSet } from "@/lib/mahjong/yaku"
import { t } from "@/lib/i18n"

type Props = {
  rules?: RuleSet
  locale?: string
}

export function RuleLegend({ rules = defaultRuleSet, locale = "ja" }: Props) {
  const items: string[] = []
  items.push(t("legend.openTanyao", locale))
  if (rules.doubleYakuman) items.push(t("legend.doubleYakuman", locale))
  if (rules.nagashiMangan) items.push(t("legend.nagashiMangan", locale))
  items.push(t("legend.kazoeYakuman", locale))

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((txt, i) => (
        <span
          key={i}
          className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 text-xs px-2 py-1"
        >
          {txt}
        </span>
      ))}
    </div>
  )
}

export default RuleLegend
