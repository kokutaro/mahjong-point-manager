import { render } from "@testing-library/react"
import React from "react"
import MeldTiles from "@/components/tiles/MeldTiles"
import type { Meld } from "@/lib/mahjong/hand-notation"

describe("MeldTiles", () => {
  test("chi: called tile placed left and rotated", () => {
    const meld: Meld = {
      kind: "chi",
      suit: "m",
      tiles: ["m2", "m3", "m4"],
      from: "shimo",
      called: "m2",
    }
    const { container } = render(<MeldTiles meld={meld} />)
    const wrappers = container.querySelectorAll("span[role='img'] > span")
    // first child span is absolute wrapper when not rotated; rotated one should have rotate-90
    // find the span under role=img that has rotate-90
    const rotated = Array.from(wrappers).find((el) =>
      el.className.includes("rotate-90")
    )
    expect(rotated).toBeTruthy()
    const imgs = container.querySelectorAll("img")
    expect(imgs[0].getAttribute("src")).toMatch(/m_2\.gif|m_2\.gif\?/) // next/image may add query
  })

  test("pon: rotate depends on from (toimen=middle)", () => {
    const meld: Meld = {
      kind: "pon",
      suit: "z",
      tiles: ["z1", "z1", "z1"],
      from: "toimen",
    }
    const { container } = render(<MeldTiles meld={meld} />)
    const wrappers = container.querySelectorAll("span[role='img'] > span")
    const rotated = Array.from(wrappers).find((el) =>
      el.className.includes("rotate-90")
    )
    expect(rotated).toBeTruthy()
  })

  test("kan (closed): ends are back tiles", () => {
    const meld: Meld = {
      kind: "kan",
      suit: "m",
      tiles: ["m2", "m2", "m2", "m2"],
      subtype: "closed",
    }
    const { container } = render(<MeldTiles meld={meld} />)
    const imgs = container.querySelectorAll("img")
    // first and last should be blank.gif
    expect(imgs[0].getAttribute("src") || "").toMatch(/blank\.gif/)
    expect(imgs[3].getAttribute("src") || "").toMatch(/blank\.gif/)
  })

  test("kan (added): stacked tile on rotated index", () => {
    const meld: Meld = {
      kind: "kan",
      suit: "p",
      tiles: ["p7", "p7", "p7", "p7"],
      subtype: "added",
      from: "kami",
    }
    const { container } = render(<MeldTiles meld={meld} />)
    // 3 base + 1 stacked = 4 images
    const imgs = container.querySelectorAll("img")
    expect(imgs.length).toBeGreaterThanOrEqual(4)
  })
})
