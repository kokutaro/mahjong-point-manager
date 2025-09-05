import { tileAriaLabel, tileToUnicode } from "@/lib/mahjong/tiles"

describe("tileToUnicode", () => {
  it("maps suits and numbers correctly", () => {
    expect(tileToUnicode("m1")).toBe("🀇")
    expect(tileToUnicode("m9")).toBe("🀏")
    expect(tileToUnicode("s1")).toBe("🀐")
    expect(tileToUnicode("s9")).toBe("🀘")
    expect(tileToUnicode("p1")).toBe("🀙")
    expect(tileToUnicode("p9")).toBe("🀡")
  })

  it("maps honors correctly", () => {
    expect(tileToUnicode("z1")).toBe("🀀") // East
    expect(tileToUnicode("z4")).toBe("🀃") // North
    expect(tileToUnicode("z5")).toBe("🀆") // White
    expect(tileToUnicode("z6")).toBe("🀅") // Green
    expect(tileToUnicode("z7")).toBe("🀄") // Red
  })
})

describe("tileAriaLabel", () => {
  it("returns readable labels for suits", () => {
    expect(tileAriaLabel("m1")).toBe("一萬")
    expect(tileAriaLabel("p9")).toBe("九筒")
    expect(tileAriaLabel("s5")).toBe("五索")
  })

  it("adds 赤 for red five", () => {
    expect(tileAriaLabel("m5r" as any)).toBe("五萬 赤")
    expect(tileAriaLabel("p5r" as any)).toBe("五筒 赤")
  })

  it("returns honors labels", () => {
    expect(tileAriaLabel("z1")).toBe("東")
    expect(tileAriaLabel("z5")).toBe("白")
    expect(tileAriaLabel("z7")).toBe("中")
  })
})
