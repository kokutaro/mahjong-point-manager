"use client"

import { useMemo, useState } from "react"
import type { Yaku } from "@/lib/mahjong/yaku"
import { YakuRow } from "./YakuRow"
import { t } from "@/lib/i18n"
import { normalizeQuery } from "@/lib/mahjong/search"

export type Filter = {
  category: "all" | "menzen-only" | "kuisagari" | "misc" | "yakuman"
  han: "all" | 1 | 2 | 3 | 6 | "yakuman"
}

type Props = {
  data: Yaku[]
  locale?: string
  defaultFilters?: Filter
}

function matchesQuery(y: Yaku, q: string, locale: string) {
  if (!q) return true
  const nq = normalizeQuery(q)
  const name = normalizeQuery(t(y.nameKey, locale))
  const aliases = (y.aliases || []).map(normalizeQuery)
  return [name, ...aliases].some((s) => s.includes(nq))
}

function matchesFilter(y: Yaku, f: Filter): boolean {
  if (f.category !== "all" && y.category !== f.category) return false
  if (f.han === "yakuman") return y.value.kind === "yakuman"
  if (typeof f.han === "number") {
    if (y.value.kind === "yakuman") return false
    const closed = y.value.closed ?? 0
    const open = y.value.open ?? 0
    return closed === f.han || open === f.han
  }
  return true
}

function sortYaku(a: Yaku, b: Yaku, locale: string): number {
  // yakuman first
  if (a.value.kind === "yakuman" && b.value.kind !== "yakuman") return -1
  if (a.value.kind !== "yakuman" && b.value.kind === "yakuman") return 1
  if (a.value.kind === "yakuman" && b.value.kind === "yakuman") {
    return b.value.rank - a.value.rank
  }
  // by han desc (closed then open)
  const ah =
    a.value.kind === "han"
      ? Math.max(a.value.closed ?? 0, a.value.open ?? 0)
      : 0
  const bh =
    b.value.kind === "han"
      ? Math.max(b.value.closed ?? 0, b.value.open ?? 0)
      : 0
  if (ah !== bh) return bh - ah
  // by localized name
  return t(a.nameKey, locale).localeCompare(t(b.nameKey, locale))
}

export function YakuTable({ data, locale = "ja", defaultFilters }: Props) {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>(
    defaultFilters || { category: "all", han: "all" }
  )

  const filtered = useMemo(() => {
    return data
      .filter((y) => matchesQuery(y, query, locale))
      .filter((y) => matchesFilter(y, filter))
      .sort((a, b) => sortYaku(a, b, locale))
  }, [data, filter, query, locale])

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <input
          type="text"
          placeholder={t("help.search.placeholder", locale)}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 px-3 py-2 border rounded-md"
        />
        <select
          className="px-2 py-2 border rounded-md"
          value={filter.category}
          onChange={(e) =>
            setFilter((f) => ({
              ...f,
              category: e.target.value as Filter["category"],
            }))
          }
        >
          <option value="all">{t("filter.category.all", locale)}</option>
          <option value="menzen-only">
            {t("filter.category.menzenOnly", locale)}
          </option>
          <option value="kuisagari">
            {t("filter.category.kuisagari", locale)}
          </option>
          <option value="misc">{t("filter.category.misc", locale)}</option>
          <option value="yakuman">
            {t("filter.category.yakuman", locale)}
          </option>
        </select>
        <select
          className="px-2 py-2 border rounded-md"
          value={String(filter.han)}
          onChange={(e) =>
            setFilter((f) => ({
              ...f,
              han: (e.target.value === "all"
                ? "all"
                : e.target.value === "yakuman"
                  ? "yakuman"
                  : Number(e.target.value)) as Filter["han"],
            }))
          }
        >
          <option value="all">{t("filter.han.all", locale)}</option>
          <option value="1">{t("filter.han.1", locale)}</option>
          <option value="2">{t("filter.han.2", locale)}</option>
          <option value="3">{t("filter.han.3", locale)}</option>
          <option value="6">{t("filter.han.6", locale)}</option>
          <option value="yakuman">{t("filter.han.yakuman", locale)}</option>
        </select>
      </div>

      <div className="divide-y divide-gray-100">
        {filtered.map((y) => (
          <YakuRow key={y.id} yaku={y} locale={locale} />
        ))}
      </div>
    </div>
  )
}

export default YakuTable
