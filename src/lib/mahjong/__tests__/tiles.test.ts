import { tileAriaLabel, tileToUnicode } from "../tiles"

describe("tileToUnicode", () => {
  it("converts suited tiles correctly", () => {
    // m1..m9, s1..s9, p1..p9 should map to Mahjong Tiles Unicode block
    expect(tileToUnicode("m1")).toBe(String.fromCodePoint(0x1f007))
    expect(tileToUnicode("m9")).toBe(String.fromCodePoint(0x1f00f))
    expect(tileToUnicode("s1")).toBe(String.fromCodePoint(0x1f010))
    expect(tileToUnicode("s9")).toBe(String.fromCodePoint(0x1f018))
    expect(tileToUnicode("p1")).toBe(String.fromCodePoint(0x1f019))
    expect(tileToUnicode("p9")).toBe(String.fromCodePoint(0x1f021))
  })

  it("converts honor tiles correctly", () => {
    const EAST = 0x1f000
    const SOUTH = 0x1f001
    const WEST = 0x1f002
    const NORTH = 0x1f003
    const WHITE = 0x1f006
    const GREEN = 0x1f005
    const RED = 0x1f004

    expect(tileToUnicode("z1")).toBe(String.fromCodePoint(EAST))
    expect(tileToUnicode("z2")).toBe(String.fromCodePoint(SOUTH))
    expect(tileToUnicode("z3")).toBe(String.fromCodePoint(WEST))
    expect(tileToUnicode("z4")).toBe(String.fromCodePoint(NORTH))
    expect(tileToUnicode("z5")).toBe(String.fromCodePoint(WHITE))
    expect(tileToUnicode("z6")).toBe(String.fromCodePoint(GREEN))
    expect(tileToUnicode("z7")).toBe(String.fromCodePoint(RED))
  })
})

describe("tileAriaLabel", () => {
  it("labels suited tiles in Japanese", () => {
    expect(tileAriaLabel("m1")).toBe("一萬")
    expect(tileAriaLabel("p9")).toBe("九筒")
    expect(tileAriaLabel("s5")).toBe("五索")
  })

  it("adds 赤 for red fives", () => {
    expect(tileAriaLabel("m5r")).toBe("五萬 赤")
    expect(tileAriaLabel("p5r")).toBe("五筒 赤")
    expect(tileAriaLabel("s5r")).toBe("五索 赤")
  })

  it("labels honor tiles in Japanese", () => {
    expect(tileAriaLabel("z1")).toBe("東")
    expect(tileAriaLabel("z2")).toBe("南")
    expect(tileAriaLabel("z3")).toBe("西")
    expect(tileAriaLabel("z4")).toBe("北")
    expect(tileAriaLabel("z5")).toBe("白")
    expect(tileAriaLabel("z6")).toBe("發")
    expect(tileAriaLabel("z7")).toBe("中")
  })
})
