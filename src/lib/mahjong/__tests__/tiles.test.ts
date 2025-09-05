import {
  tileAriaLabel,
  tileToImageSrc,
  type TileCode,
} from "@/lib/mahjong/tiles"

describe("tileToImageSrc", () => {
  it("maps suits and numbers correctly", () => {
    expect(tileToImageSrc("m1")).toBe("/img/pai/m_1.gif")
    expect(tileToImageSrc("m9")).toBe("/img/pai/m_9.gif")
    expect(tileToImageSrc("s1")).toBe("/img/pai/s_1.gif")
    expect(tileToImageSrc("s9")).toBe("/img/pai/s_9.gif")
    expect(tileToImageSrc("p1")).toBe("/img/pai/p_1.gif")
    expect(tileToImageSrc("p9")).toBe("/img/pai/p_9.gif")
  })

  it("maps honors correctly", () => {
    expect(tileToImageSrc("z1")).toBe("/img/pai/z_1.gif") // East
    expect(tileToImageSrc("z4")).toBe("/img/pai/z_4.gif") // North
    expect(tileToImageSrc("z5")).toBe("/img/pai/z_5.gif") // White
    expect(tileToImageSrc("z6")).toBe("/img/pai/z_6.gif") // Green
    expect(tileToImageSrc("z7")).toBe("/img/pai/z_7.gif") // Red
  })

  it("uses normal five image for red fives", () => {
    const m5r: TileCode = "m5r"
    const p5r: TileCode = "p5r"
    const s5r: TileCode = "s5r"
    expect(tileToImageSrc(m5r)).toBe("/img/pai/m_5.gif")
    expect(tileToImageSrc(p5r)).toBe("/img/pai/p_5.gif")
    expect(tileToImageSrc(s5r)).toBe("/img/pai/s_5.gif")
  })
})

describe("tileAriaLabel", () => {
  it("returns readable labels for suits", () => {
    expect(tileAriaLabel("m1")).toBe("一萬")
    expect(tileAriaLabel("p9")).toBe("九筒")
    expect(tileAriaLabel("s5")).toBe("五索")
  })

  it("adds 赤 for red five", () => {
    const m5r: TileCode = "m5r"
    const p5r: TileCode = "p5r"
    expect(tileAriaLabel(m5r)).toBe("五萬 赤")
    expect(tileAriaLabel(p5r)).toBe("五筒 赤")
  })

  it("returns honors labels", () => {
    expect(tileAriaLabel("z1")).toBe("東")
    expect(tileAriaLabel("z5")).toBe("白")
    expect(tileAriaLabel("z7")).toBe("中")
  })
})
