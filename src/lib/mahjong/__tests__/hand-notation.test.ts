import {
  formatHandNotation,
  parseHandNotation,
  mapCallFromSymbol,
} from "@/lib/mahjong/hand-notation"

describe("mapCallFromSymbol", () => {
  it("maps symbols to names", () => {
    expect(mapCallFromSymbol("-")).toBe("shimo")
    expect(mapCallFromSymbol("=")).toBe("toimen")
    expect(mapCallFromSymbol("+")).toBe("kami")
  })
})

describe("parseHandNotation", () => {
  it("parses concealed + tsumo + pon + ankan", () => {
    const parsed = parseHandNotation("s123m222s44_,z111-,z2222")
    // concealed should exclude tsumo (s4)
    expect(parsed.tsumo).toBe("s4")
    expect(parsed.concealed.sort()).toEqual(
      ["s1", "s2", "s3", "m2", "m2", "m2", "s4"].sort()
    )
    expect(parsed.melds.length).toBe(2)
    // z111- : pon from shimo
    const m1 = parsed.melds[0]
    expect(m1.kind).toBe("pon")
    expect(m1.suit).toBe("z")
    expect(m1.from).toBe("shimo")
    // z2222 : closed kan
    const m2 = parsed.melds[1]
    expect(m2.kind).toBe("kan")
    expect(m2.suit).toBe("z")
    expect(m2.subtype).toBe("closed")
  })

  it("parses chi and kakan", () => {
    const parsed = parseHandNotation("m123s55_,s123-,s222=2")
    expect(parsed.tsumo).toBe("s5")
    expect(parsed.melds[0].kind).toBe("chi")
    expect(parsed.melds[1].kind).toBe("kan")
    // added kan retains from
    if (parsed.melds[1].kind === "kan") {
      expect(parsed.melds[1].subtype).toBe("added")
      expect(parsed.melds[1].from).toBe("toimen")
    }
  })

  it("rejects invalid forms", () => {
    expect(() => parseHandNotation("")).toThrow()
    expect(() => parseHandNotation("123m")).toThrow() // number before suit
    expect(() => parseHandNotation("m12x")).toThrow() // invalid char
    expect(() => parseHandNotation("m123_s")).toThrow() // underscore position
    expect(() => parseHandNotation("s222=")).toThrow() // incomplete meld
  })
})

describe("formatHandNotation", () => {
  it("formats round trip to a canonical string", () => {
    const input = "s123m222s44_,z111-,z2222"
    const parsed = parseHandNotation(input)
    const out = formatHandNotation(parsed)
    // Should keep meld order and represent tsumo at end of concealed
    expect(out).toMatch(/_,z111-,z2222$/)
    // concealed should include s suit last (tsumo suit)
    const concealedBlock = out.split(",")[0]
    expect(concealedBlock.endsWith("_"))
    expect(concealedBlock).toMatch(/^m2{3}s[1-9]+_$/)
  })
})
