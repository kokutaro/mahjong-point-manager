import { tileToUnicode } from "@/lib/mahjong/tiles"

describe("tileToUnicode", () => {
  test("数牌と字牌のUnicodeに変換できる", () => {
    expect(tileToUnicode("m1")).toMatch(/\p{Extended_Pictographic}/u)
    expect(tileToUnicode("p9")).toMatch(/\p{Extended_Pictographic}/u)
    expect(tileToUnicode("s5")).toMatch(/\p{Extended_Pictographic}/u)
    expect(tileToUnicode("z1")).toBeDefined() // 東
    expect(tileToUnicode("z7")).toBeDefined() // 中
  })

  test("不正値はフォールバックを返す", () => {
    // @ts-expect-error 故意に無効値を渡す
    expect(tileToUnicode("x1")).toBe("🀫")
  })
})
