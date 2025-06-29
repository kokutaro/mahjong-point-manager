import { render, screen, act } from "@testing-library/react"
import AlertModal from "../AlertModal"

jest.useFakeTimers()

describe("AlertModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <AlertModal isOpen={false} message="msg" onConfirm={jest.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it("shows message and calls onConfirm", () => {
    const onConfirm = jest.fn()
    render(<AlertModal isOpen={true} message="test" onConfirm={onConfirm} />)
    screen.getByRole("button").click()
    expect(onConfirm).toHaveBeenCalled()
  })

  it("auto confirms after countdown", () => {
    const onConfirm = jest.fn()
    render(
      <AlertModal
        isOpen={true}
        message="auto"
        onConfirm={onConfirm}
        countdownSeconds={1}
      />
    )
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(onConfirm).toHaveBeenCalled()
  })
})
