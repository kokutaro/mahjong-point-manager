import { render, screen, fireEvent } from "@testing-library/react"
import SessionHistoryModal from "../SessionHistoryModal"

jest.mock("../SessionHistoryTable", () => {
  return function MockTable() {
    return <div>table</div>
  }
})

describe("SessionHistoryModal", () => {
  test("renders when open", () => {
    render(<SessionHistoryModal isOpen onClose={() => {}} sessionId="s1" />)
    expect(screen.getByText("セッション履歴")).toBeInTheDocument()
    expect(screen.getByText("table")).toBeInTheDocument()
  })

  test("returns null when closed or no sessionId", () => {
    const { container } = render(
      <SessionHistoryModal isOpen={false} onClose={() => {}} sessionId="s1" />
    )
    expect(container.firstChild).toBeNull()

    const { container: c2 } = render(
      <SessionHistoryModal isOpen onClose={() => {}} sessionId={null} />
    )
    expect(c2.firstChild).toBeNull()
  })

  test("triggers onClose", () => {
    const onClose = jest.fn()
    render(<SessionHistoryModal isOpen onClose={onClose} sessionId="s1" />)
    fireEvent.click(screen.getByRole("button"))
    expect(onClose).toHaveBeenCalled()
  })
})
