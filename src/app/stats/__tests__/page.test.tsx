import { render, screen, waitFor } from "@testing-library/react"
import StatsPage from "../page"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}))

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}))

jest.mock("@/components/ErrorDisplay", () => {
  return function ErrorDisplay({ error, onRetry }: any) {
    return (
      <div data-testid="error-display">
        <span>{error.message}</span>
        {onRetry && <button onClick={onRetry}>Retry</button>}
      </div>
    )
  }
})

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>
const mockPush = jest.fn()
;(useRouter as jest.Mock).mockReturnValue({ push: mockPush })

const sampleStats = {
  playerId: "player-1",
  playerName: "Test Player",
  totalGames: 2,
  winRate: 50,
  averageRank: 2,
  averagePoints: 25000,
  totalSettlement: 1000,
  rankDistribution: { 1: 1, 2: 0, 3: 1, 4: 0 },
  gameTypeStats: {
    HANCHAN: {
      totalGames: 1,
      winRate: 100,
      averageRank: 1,
      totalSettlement: 1500,
      rankDistribution: { 1: 1, 2: 0, 3: 0, 4: 0 },
    },
    TONPUU: {
      totalGames: 1,
      winRate: 0,
      averageRank: 3,
      totalSettlement: -500,
      rankDistribution: { 1: 0, 2: 0, 3: 1, 4: 0 },
    },
  },
  recentGames: [
    {
      gameId: "game-1",
      endedAt: "2024-01-01T00:00:00Z",
      gameType: "HANCHAN",
      rank: 1,
      points: 30000,
      settlement: 1500,
    },
  ],
  monthlyStats: { "2024-01": { games: 2, wins: 1, totalSettlement: 1000 } },
}

describe("StatsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("shows login required when unauthenticated", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      refreshAuth: jest.fn(),
    } as any)

    render(<StatsPage />)
    expect(screen.getByText("ログインが必要です")).toBeInTheDocument()
  })

  it("shows loading indicator while fetching stats", async () => {
    mockUseAuth.mockReturnValue({
      user: { playerId: "player-1", name: "Test" },
      isAuthenticated: true,
      refreshAuth: jest.fn(),
    } as any)

    const fetchPromise = new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          ok: true,
          json: async () => ({ success: true, data: sampleStats }),
        })
      }, 50)
    })

    ;(global.fetch as jest.Mock).mockImplementation(() => fetchPromise as any)

    render(<StatsPage />)
    expect(screen.getByText("統計を読み込み中...")).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText("統計ダッシュボード")).toBeInTheDocument()
    })
  })

  it("renders stats after successful fetch", async () => {
    mockUseAuth.mockReturnValue({
      user: { playerId: "player-1", name: "Test" },
      isAuthenticated: true,
      refreshAuth: jest.fn(),
    } as any)
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: sampleStats }),
    })

    render(<StatsPage />)

    await waitFor(() => {
      expect(screen.getByText("Test Playerさんの対局統計")).toBeInTheDocument()
    })
    expect(screen.getByText("2局")).toBeInTheDocument()
    expect(screen.getAllByText("50.0%").length).toBeGreaterThan(0)
  })

  it("shows error display when fetch fails", async () => {
    mockUseAuth.mockReturnValue({
      user: { playerId: "player-1", name: "Test" },
      isAuthenticated: true,
      refreshAuth: jest.fn(),
    } as any)
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: "failed" } }),
    })

    render(<StatsPage />)

    await waitFor(() => {
      expect(screen.getByTestId("error-display")).toBeInTheDocument()
    })
  })
})
