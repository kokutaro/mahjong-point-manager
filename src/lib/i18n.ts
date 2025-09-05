import ja from "@/locales/ja.json"

type Dict = Record<string, string>

const dicts: Record<string, Dict> = {
  ja,
}

export function t(key: string, locale: string = "ja"): string {
  const d = dicts[locale] || dicts.ja
  return d[key] || key
}
