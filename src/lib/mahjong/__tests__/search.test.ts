import { normalizeQuery, yakuMatches } from "../search"

describe("normalizeQuery", () => {
  it("normalizes width and case and kana", () => {
    expect(normalizeQuery("ﾀﾝﾔｵ")).toBe("たんやお")
    expect(normalizeQuery("タンヤオ")).toBe("たんやお")
    expect(normalizeQuery("tAnYaO")).toBe("tanyao")
    expect(normalizeQuery(" ピンフ ")).toBe("ぴんふ")
  })
})

describe("yakuMatches", () => {
  const yaku = {
    id: "tanyao",
    name: "断么九",
    aliases: ["タンヤオ", "たんやお", "tanyao"],
  }

  it("matches by kana/kanji/romaji", () => {
    expect(yakuMatches(yaku, "タンヤオ")).toBe(true)
    expect(yakuMatches(yaku, "たんやお")).toBe(true)
    expect(yakuMatches(yaku, "tanyao")).toBe(true)
    expect(yakuMatches(yaku, "断么九")).toBe(true)
  })

  it("does not match unrelated queries", () => {
    expect(yakuMatches(yaku, "平和")).toBe(false)
  })
})
