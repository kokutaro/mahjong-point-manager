import { render, screen, fireEvent } from "@testing-library/react"
import Page from "@/app/dev/hand-notation/page"

describe("/dev/hand-notation demo page", () => {
  it("renders initial example and updates on input", () => {
    render(<Page />)

    // 初期表示
    expect(screen.getByText("牌姿短縮表記デモ")).toBeInTheDocument()
    const input = screen.getByLabelText("入力") as HTMLInputElement
    expect(input.value).toContain("s123m222s44_")

    // 入力更新: シンプルな形
    fireEvent.change(input, { target: { value: "m123p456s789_" } })
    // ツモが5ではなく9だが、UIは parse できるはず（9s をツモ）
    expect(screen.queryByText(/invalid/i)).not.toBeInTheDocument()

    // 整形表記に _ が含まれる（ツモ付き）
    expect(screen.getByText((c) => c.includes("_"))).toBeInTheDocument()
  })

  it("shows error for invalid notation", () => {
    render(<Page />)
    const input = screen.getByLabelText("入力") as HTMLInputElement
    fireEvent.change(input, { target: { value: "123m" } })
    expect(screen.getByText(/number before suit/i)).toBeInTheDocument()
  })
})
