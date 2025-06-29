import { render, screen, fireEvent } from "@testing-library/react"
import MenuDrawer from "../MenuDrawer"

describe("MenuDrawer", () => {
  const onClose = jest.fn()
  const onShowHistory = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns null when closed", () => {
    const { container } = render(
      <MenuDrawer
        isOpen={false}
        onClose={onClose}
        onShowHistory={onShowHistory}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it("calls onClose when clicking backdrop", () => {
    const { container } = render(
      <MenuDrawer isOpen onClose={onClose} onShowHistory={onShowHistory} />
    )
    fireEvent.click(
      (container.firstChild as HTMLElement).firstChild as HTMLElement
    )
    expect(onClose).toHaveBeenCalled()
  })

  it("handles history click", () => {
    render(
      <MenuDrawer isOpen onClose={onClose} onShowHistory={onShowHistory} />
    )
    fireEvent.click(screen.getByText("📋 セッション履歴"))
    expect(onShowHistory).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})
