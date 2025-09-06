import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import YakuHelpModal from "@/components/help/YakuHelpModal"

describe("YakuHelpModal", () => {
  test("isOpen=false の場合は表示されない", () => {
    const { container } = render(
      <YakuHelpModal isOpen={false} onClose={() => {}} />
    )
    expect(container.firstChild).toBeNull()
  })

  test("isOpen=true で開閉ボタンが動作する", () => {
    const onClose = jest.fn()
    render(<YakuHelpModal isOpen={true} onClose={onClose} />)

    expect(screen.getByRole("heading", { name: "ヘルプ" })).toBeInTheDocument()
    const btn = screen.getByRole("button", { name: "ヘルプを閉じる" })
    fireEvent.click(btn)
    expect(onClose).toHaveBeenCalled()
  })
})
