import React from "react"
import { render, screen } from "@testing-library/react"
import YakuHelp from "@/components/help/YakuHelp"

describe("YakuHelp", () => {
  test("タイトルと子要素が表示される", () => {
    render(<YakuHelp />)
    expect(screen.getByText("役・飜数ヘルプ")).toBeInTheDocument()
    // ルール凡例（バッジの一つを確認）
    expect(screen.getByText("オープン断么なし")).toBeInTheDocument()
  })
})
