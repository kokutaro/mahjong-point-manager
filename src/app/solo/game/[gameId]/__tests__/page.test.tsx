import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import SoloGamePage from "../page"
import { useRouter } from "next/navigation"

// Mock router
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}))

// Mock child components used in main render to simplify output
jest.mock("@/components/GameEndScreen", () => ({
  __esModule: true,
  default: ({ onShowResult }: any) => (
    <div data-testid="game-end-screen">
      <button onClick={onShowResult}>Show Result</button>
    </div>
  ),
}))

jest.mock("@/components/GameResult", () => ({
  __esModule: true,
  default: ({ gameId, onBack }: any) => (
    <div data-testid="game-result">
      Result {gameId}
      <button onClick={onBack}>Back</button>
    </div>
  ),
}))

jest.mock("@/components/solo/SoloScoreForm", () => ({
  __esModule: true,
  default: () => <div data-testid="solo-score-form" />,
}))

jest.mock("@/components/solo/SoloRyukyokuForm", () => ({
  __esModule: true,
  default: () => <div data-testid="solo-ryukyoku-form" />,
}))

beforeEach(() => {
  ;(useRouter as jest.Mock).mockReturnValue({ push: jest.fn() })
  jest.clearAllMocks()
  global.fetch = jest.fn()
})

const baseState = {
  gameId: "game1",
  players: [
    { position: 0, name: "P1", points: 25000, isReach: false },
    { position: 1, name: "P2", points: 25000, isReach: false },
    { position: 2, name: "P3", points: 25000, isReach: false },
    { position: 3, name: "P4", points: 25000, isReach: false },
  ],
  currentRound: 1,
  currentOya: 0,
  honba: 0,
  kyotaku: 0,
  status: "WAITING" as const,
}

describe("SoloGamePage", () => {
  it("displays loading state initially", async () => {
    ;(global.fetch as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({
                  success: true,
                  data: { gameState: baseState },
                }),
              }),
            100
          )
        })
    )

    render(<SoloGamePage params={Promise.resolve({ gameId: "game1" })} />)

    expect(screen.getByText("読み込み中...")).toBeInTheDocument()

    await waitFor(() =>
      expect(
        screen.getByText("ゲームを開始する準備ができました")
      ).toBeInTheDocument()
    )
  })

  it("shows error screen when fetch fails", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: "fail" } }),
    })

    render(<SoloGamePage params={Promise.resolve({ gameId: "game1" })} />)

    await waitFor(() => expect(screen.getByText("エラー")).toBeInTheDocument())
  })

  it("renders waiting view before start", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { gameState: baseState } }),
    })

    render(<SoloGamePage params={Promise.resolve({ gameId: "game1" })} />)

    await waitFor(() =>
      expect(screen.getByText("ゲーム開始")).toBeInTheDocument()
    )
  })

  it("starts game on button click", async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { gameState: baseState } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { gameState: { ...baseState, status: "PLAYING" } },
        }),
      })

    render(<SoloGamePage params={Promise.resolve({ gameId: "game1" })} />)

    await waitFor(() =>
      expect(screen.getByText("ゲーム開始")).toBeInTheDocument()
    )

    fireEvent.click(screen.getByText("ゲーム開始"))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith(
        `/api/game/game1`,
        expect.objectContaining({ method: "PATCH" })
      )
    })

    await waitFor(() =>
      expect(screen.getByText("ゲームアクション")).toBeInTheDocument()
    )
  })
})
