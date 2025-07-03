import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import SessionsPage from "../page"
import { useRouter } from "next/navigation"

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}))

jest.mock("@/components/ErrorDisplay", () => {
  return function ErrorDisplay({ error, onRetry, onDismiss }: any) {
    return (
      <div data-testid="error-display">
        <span>{error.message}</span>
        {onRetry && <button onClick={onRetry}>Retry</button>}
        {onDismiss && <button onClick={onDismiss}>Dismiss</button>}
      </div>
    )
  }
})

const mockPush = jest.fn()

describe("SessionsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({ push: mockPush })
  })

  it("fetches sessions and displays them", async () => {
    const mockSessions = [
      {
        id: "s1",
        sessionCode: "ABC",
        name: "Test Session",
        status: "ACTIVE",
        createdAt: "2024-01-01T00:00:00Z",
        endedAt: null,
        hostPlayer: { id: "h1", name: "Host" },
        totalGames: 2,
        participants: [
          {
            playerId: "p1",
            name: "Player1",
            position: 0,
            totalSettlement: 1000,
            gamesPlayed: 2,
          },
        ],
        settings: null,
      },
    ]

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { sessions: mockSessions, pagination: { total: 1 } },
      }),
    })

    render(<SessionsPage />)

    expect(
      screen.getByText("セッション一覧を読み込み中...")
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText("Test Session")).toBeInTheDocument()
    })

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/sessions?limit=10&offset=0",
      expect.objectContaining({ method: "GET", credentials: "include" })
    )
  })

  it("shows error when fetch fails and retries", async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error("Network Error"))

    render(<SessionsPage />)

    await waitFor(() => {
      expect(screen.getByTestId("error-display")).toBeInTheDocument()
    })

    const retryButton = screen.getByText("Retry")

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { sessions: [], pagination: { total: 0 } },
      }),
    })

    fireEvent.click(retryButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })

  it("shows empty state when there are no sessions", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { sessions: [], pagination: { total: 0 } },
      }),
    })

    render(<SessionsPage />)

    await waitFor(() => {
      expect(screen.getByText("セッション履歴がありません")).toBeInTheDocument()
    })
  })

  it("navigates home when home button clicked", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { sessions: [], pagination: { total: 0 } },
      }),
    })

    render(<SessionsPage />)

    await waitFor(() => screen.getByText("ホームに戻る"))

    fireEvent.click(screen.getByText("ホームに戻る"))

    expect(mockPush).toHaveBeenCalledWith("/")
  })
})
