import { render, screen, waitFor } from "@testing-library/react"
import SessionHistoryTable from "@/components/SessionHistoryTable"

// fetchのモック
global.fetch = jest.fn()

const mockSessionData = {
  session: {
    id: "session1",
    sessionCode: "123456",
    name: "テストセッション",
    status: "ACTIVE",
    createdAt: "2024-01-01T00:00:00.000Z",
    endedAt: null,
    hostPlayer: {
      id: "host1",
      name: "ホスト",
    },
  },
  players: [
    {
      playerId: "player1",
      name: "プレイヤー1",
      position: 0,
      totalGames: 2,
      totalSettlement: 1500,
      firstPlace: 1,
      secondPlace: 1,
      thirdPlace: 0,
      fourthPlace: 0,
    },
    {
      playerId: "player2",
      name: "プレイヤー2",
      position: 1,
      totalGames: 2,
      totalSettlement: -500,
      firstPlace: 0,
      secondPlace: 1,
      thirdPlace: 1,
      fourthPlace: 0,
    },
  ],
  gameResults: [
    {
      gameNumber: 1,
      gameId: "game1",
      gameType: "HANCHAN" as const,
      endedAt: "2024-01-01T01:00:00.000Z",
      results: {
        player1: 1000,
        player2: -300,
        player3: -200,
        player4: -500,
      },
    },
    {
      gameNumber: 2,
      gameId: "game2",
      gameType: "TONPUU" as const,
      endedAt: "2024-01-01T02:00:00.000Z",
      results: {
        player1: 500,
        player2: -200,
        player3: 300,
        player4: -600,
      },
    },
  ],
  totalRow: {
    player1: 1500,
    player2: -500,
    player3: 100,
    player4: -1100,
  },
}

describe("SessionHistoryTable", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("セッション履歴を正常に表示する", async () => {
    const mockFetch = fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockSessionData,
      }),
    } as Response)

    render(<SessionHistoryTable sessionId="session1" />)

    // ローディング状態を確認
    expect(
      screen.getByText("セッション履歴を読み込み中...")
    ).toBeInTheDocument()

    // データが読み込まれるのを待つ
    await waitFor(() => {
      expect(screen.getByText("テストセッション")).toBeInTheDocument()
    })

    // セッション情報の表示を確認
    expect(
      screen.getByText("ホスト: ホスト | 総対局数: 2局")
    ).toBeInTheDocument()

    // プレイヤー名の表示を確認
    expect(screen.getAllByText("プレイヤー1").length).toBeGreaterThan(0)
    expect(screen.getAllByText("プレイヤー2").length).toBeGreaterThan(0)

    // 対局結果の表示を確認
    expect(screen.getByText("1局")).toBeInTheDocument()
    expect(screen.getByText("2局")).toBeInTheDocument()
    expect(screen.getByText("+1,000")).toBeInTheDocument()
    expect(screen.getByText("-300")).toBeInTheDocument()

    // 合計行の表示を確認
    expect(screen.getByText("合計")).toBeInTheDocument()
    expect(screen.getByText("+1,500")).toBeInTheDocument()
    expect(screen.getByText("-500")).toBeInTheDocument()

    // 統計情報の表示を確認
    expect(screen.getByText("セッション統計")).toBeInTheDocument()
    expect(screen.getByText("1位: 1回")).toBeInTheDocument()
  })

  it("APIエラー時にエラーメッセージを表示する", async () => {
    const mockFetch = fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        success: false,
        error: { message: "セッションが見つかりません" },
      }),
    } as Response)

    render(<SessionHistoryTable sessionId="invalid-session" />)

    await waitFor(() => {
      expect(screen.getByText("セッションが見つかりません")).toBeInTheDocument()
    })
  })

  it("対局データがない場合は適切なメッセージを表示する", async () => {
    const emptySessionData = {
      ...mockSessionData,
      gameResults: [],
    }

    const mockFetch = fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: emptySessionData,
      }),
    } as Response)

    render(<SessionHistoryTable sessionId="session1" />)

    await waitFor(() => {
      expect(
        screen.getByText("まだ完了した対局がありません")
      ).toBeInTheDocument()
    })
  })

  it("正しいAPIエンドポイントを呼び出す", async () => {
    const mockFetch = fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockSessionData,
      }),
    } as Response)

    render(<SessionHistoryTable sessionId="test-session-id" />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/sessions/test-session-id", {
        method: "GET",
        credentials: "include",
      })
    })
  })
})
