import React from "react"
import { render, screen } from "@testing-library/react"
import { RuleLegend } from "@/components/yaku/RuleLegend"

describe("RuleLegend", () => {
  test("デフォルトルールでバッジが表示される", () => {
    render(<RuleLegend />)
    expect(screen.getByText("オープン断么なし")).toBeInTheDocument()
    expect(screen.getByText("ダブル役満あり")).toBeInTheDocument()
    expect(screen.getByText("流し満貫あり")).toBeInTheDocument()
    expect(screen.getByText("数え役満なし")).toBeInTheDocument()
  })

  test("ルール指定で条件分岐が反映される", () => {
    render(
      <RuleLegend
        rules={{
          openTanyao: false,
          doubleYakuman: false,
          nagashiMangan: false,
          kazoeYakuman: false,
        }}
      />
    )
    expect(screen.getByText("オープン断么なし")).toBeInTheDocument()
    // 条件付き2つは非表示
    expect(screen.queryByText("ダブル役満あり")).toBeNull()
    expect(screen.queryByText("流し満貫あり")).toBeNull()
    expect(screen.getByText("数え役満なし")).toBeInTheDocument()
  })
})
