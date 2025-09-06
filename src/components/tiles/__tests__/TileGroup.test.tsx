import React from "react"
import { render } from "@testing-library/react"
import TileGroup from "@/components/tiles/TileGroup"

describe("TileGroup", () => {
  test("codes の数だけ Tile が並ぶ", () => {
    const { container } = render(<TileGroup codes={["m1", "p5r", "z7"]} />)
    // span.inline-flex の直下に Tile コンポーネントが3つ入る
    const root = container.querySelector("span.inline-flex")
    expect(root).toBeTruthy()
    expect(root?.children.length).toBe(3)
  })

  test("gap と wrap のクラスが適用される", () => {
    const { container } = render(
      <TileGroup codes={["m1"]} gap="md" wrap={true} className="extra" />
    )
    const root = container.querySelector("span")
    expect(root).toBeTruthy()
    expect(root?.className).toContain("gap-2")
    expect(root?.className).toContain("flex-wrap")
    expect(root?.className).toContain("extra")
  })
})
