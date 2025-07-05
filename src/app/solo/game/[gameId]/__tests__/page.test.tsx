import { render, screen, fireEvent, waitFor } from "@testing-library/react"

import SoloGamePage from "@/app/solo/game/[gameId]/page"
import { useRouter } from "next/navigation"

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}))

jest.mock("@/components/GameEndScreen", () => {
  return function GameEndScreen({ onShowResult }: any) {
    return (
      <div data-testid="game-end-screen">
        <button onClick={onShowResult}>Show Result</button>
      </div>
    )
  }
})

jest.mock("@/components/GameResult", () => {
  return function GameResult({ gameId, onBack }: any) {
    return (
      <div data-testid="game-result">
        <span>Result: {gameId}</span>
        <button onClick={onBack}>Back</button>
      </div>
    )
  }
})

const mockPush = jest.fn()
;(useRouter as jest.Mock).mockReturnValue({ push: mockPush })

global.fetch = jest.fn()

describe("SoloGamePage", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({ push: mockPush })
  })

  it("shows loading while fetching state", () => {
    ;(global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}))

    render(<SoloGamePage params={Promise.resolve({ gameId: "g1" })} />)

    expect(screen.getByText("読み込み中...")).toBeInTheDocument()
  })

  it("displays error message and navigates home", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: "not found" } }),
    })

    render(<SoloGamePage params={Promise.resolve({ gameId: "g1" })} />)

    await waitFor(() => {
      expect(screen.getByText("not found")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText("ホームに戻る"))
    expect(mockPush).toHaveBeenCalledWith("/")
  })

  it("shows waiting state with start button", async () => {
    const waitingState = {
      gameId: "g1",
      status: "WAITING" as const,
      currentRound: 1,
      currentOya: 0,
      honba: 0,
      kyotaku: 0,
      players: [
        { position: 0, name: "A", points: 25000, isReach: false },
        { position: 1, name: "B", points: 25000, isReach: false },
        { position: 2, name: "C", points: 25000, isReach: false },
        { position: 3, name: "D", points: 25000, isReach: false },
      ],
    }
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { gameState: waitingState } }),
    })
    render(<SoloGamePage params={Promise.resolve({ gameId: "g1" })} />)
    await screen.findByText("ゲーム開始")
    expect(screen.getByText("ゲーム開始")).toBeInTheDocument()
  })

  it("shows result screen when game finished", async () => {
    const finishedState = {
      gameId: "g1",
      status: "FINISHED" as const,
      currentRound: 1,
      currentOya: 0,
      honba: 0,
      kyotaku: 0,
      players: [],
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { gameState: finishedState } }),
    })

    render(<SoloGamePage params={Promise.resolve({ gameId: "g1" })} />)

    await screen.findByTestId("game-end-screen")
    fireEvent.click(screen.getByText("Show Result"))

    await screen.findByTestId("game-result")
    expect(screen.getByText("Result: g1")).toBeInTheDocument()
  })
})
