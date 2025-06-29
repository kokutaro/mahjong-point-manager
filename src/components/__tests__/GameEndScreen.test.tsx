import { render, screen, act } from "@testing-library/react"
import GameEndScreen from "../GameEndScreen"

describe("GameEndScreen", () => {
  it("calls onShowResult after countdown", () => {
    jest.useFakeTimers()
    const onShow = jest.fn()
    render(
      <GameEndScreen gameType="HANCHAN" endReason="end" onShowResult={onShow} />
    )
    act(() => {
      jest.advanceTimersByTime(5000)
    })
    act(() => {
      jest.runOnlyPendingTimers()
    })
    expect(onShow).toHaveBeenCalled()
    jest.useRealTimers()
  })

  it("triggers onShowResult on button click", () => {
    jest.useFakeTimers()
    const onShow = jest.fn()
    render(
      <GameEndScreen gameType="HANCHAN" endReason="end" onShowResult={onShow} />
    )
    act(() => {
      screen.getByRole("button", { name: /結果を見る/ }).click()
    })
    act(() => {
      jest.runOnlyPendingTimers()
    })
    expect(onShow).toHaveBeenCalled()
    jest.useRealTimers()
  })
})
