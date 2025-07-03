import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { useParams, useRouter } from "next/navigation"
import GamePage from "../page"
import { useAuth } from "@/contexts/AuthContext"
import { useSocket } from "@/hooks/useSocket"

// モック対象のコンポーネントをモック
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

jest.mock("@/components/GameEndScreen", () => {
  return function GameEndScreen({ onShowResult }: any) {
    return (
      <div data-testid="game-end-screen">
        <button onClick={onShowResult}>Show Result</button>
      </div>
    )
  }
})

jest.mock("@/components/GameInfo", () => {
  return function GameInfo({ gameState, isConnected, gameType }: any) {
    return (
      <div data-testid="game-info">
        <span>Game: {gameState?.gameId}</span>
        <span>Connected: {isConnected ? "yes" : "no"}</span>
        <span>Type: {gameType}</span>
      </div>
    )
  }
})

jest.mock("@/components/GameResult", () => {
  return function GameResult({ gameId, onBack }: any) {
    return (
      <div data-testid="game-result">
        <span>Result for: {gameId}</span>
        <button onClick={onBack}>Back</button>
      </div>
    )
  }
})

jest.mock("@/components/PlayerStatus", () => {
  return function PlayerStatus({
    gameState,
    currentPlayer,
    onReach,
    canDeclareReach,
  }: any) {
    return (
      <div data-testid="player-status">
        <span>Players: {gameState?.players?.length || 0}</span>
        {currentPlayer && <span>Current: {currentPlayer.name}</span>}
        {currentPlayer && canDeclareReach(currentPlayer) && (
          <button onClick={() => onReach(currentPlayer.playerId)}>
            Can Reach
          </button>
        )}
      </div>
    )
  }
})

jest.mock("@/components/ScoreInputForm", () => {
  return function ScoreInputForm({ onSubmit, onCancel, actionType }: any) {
    return (
      <div data-testid="score-input-form">
        <span>Action: {actionType}</span>
        <button
          onClick={() =>
            onSubmit({
              winnerId: "p1",
              han: 1,
              fu: 30,
              isTsumo: actionType === "tsumo",
              loserId: actionType === "ron" ? "p2" : undefined,
            })
          }
        >
          Submit Score
        </button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    )
  }
})

jest.mock("@/components/RyukyokuForm", () => {
  return function RyukyokuForm({ onSubmit, onCancel }: any) {
    return (
      <div data-testid="ryukyoku-form">
        <button onClick={() => onSubmit(["p1", "p2"])}>Submit Ryukyoku</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    )
  }
})

jest.mock("@/components/MenuDrawer", () => {
  return function MenuDrawer({ isOpen, onClose }: any) {
    return isOpen ? (
      <div data-testid="menu-drawer">
        <button onClick={onClose}>Close Menu</button>
      </div>
    ) : null
  }
})

jest.mock("@/components/SessionHistoryModal", () => {
  return function SessionHistoryModal({ isOpen, onClose }: any) {
    return isOpen ? (
      <div data-testid="session-history-modal">
        <button onClick={onClose}>Close History</button>
      </div>
    ) : null
  }
})

jest.mock("@/components/PointAnimation", () => {
  return function PointAnimation({ onComplete }: any) {
    return (
      <div data-testid="point-animation">
        <button onClick={onComplete}>Complete Animation</button>
      </div>
    )
  }
})

// フックのモック
jest.mock("@/contexts/AuthContext")
jest.mock("@/hooks/useSocket")

// next/navigationを再モック（useParamsを追加）
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  useParams: jest.fn(),
  useSearchParams: jest.fn(() => new URLSearchParams()),
  usePathname: jest.fn(() => "/"),
}))

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>
const mockUseSocket = useSocket as jest.MockedFunction<typeof useSocket>

describe("GamePage", () => {
  const mockPush = jest.fn()
  const mockJoinRoom = jest.fn()
  const mockManualReconnect = jest.fn()

  const mockAuthUser = {
    playerId: "p1",
    name: "Test Player",
    deviceId: "device1",
  }

  const mockGameState = {
    gameId: "game1",
    players: [
      {
        playerId: "p1",
        name: "Player 1",
        position: 0,
        points: 25000,
        isReach: false,
        isConnected: true,
      },
      {
        playerId: "p2",
        name: "Player 2",
        position: 1,
        points: 25000,
        isReach: false,
        isConnected: true,
      },
      {
        playerId: "p3",
        name: "Player 3",
        position: 2,
        points: 25000,
        isReach: false,
        isConnected: true,
      },
      {
        playerId: "p4",
        name: "Player 4",
        position: 3,
        points: 25000,
        isReach: false,
        isConnected: true,
      },
    ],
    currentRound: 1,
    currentOya: 0,
    honba: 0,
    kyotaku: 0,
    gamePhase: "playing" as const,
  }

  const mockGameInfo = {
    roomCode: "ABCD",
    sessionId: "session1",
    settings: {
      gameType: "HANCHAN" as const,
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()

    // next/navigationのモックを上書き
    ;(useParams as jest.Mock).mockReturnValue({ gameId: "game1" })
    ;(useRouter as jest.Mock).mockReturnValue({ push: mockPush })

    mockUseAuth.mockReturnValue({
      user: mockAuthUser,
      isAuthenticated: true,
      isLoading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshAuth: jest.fn(),
      error: null,
    })

    mockUseSocket.mockReturnValue({
      socket: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
        onAny: jest.fn(),
        offAny: jest.fn(),
        connected: true,
        id: "mock-socket-id",
      } as any,
      isConnected: true,
      error: null,
      isReconnecting: false,
      reconnectTimeLeft: 0,
      manualReconnect: mockManualReconnect,
      joinRoom: mockJoinRoom,
    })

    // fetch のモック
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          gameState: mockGameState,
          gameInfo: mockGameInfo,
        },
      }),
    })
  })

  describe("認証状態", () => {
    it("未認証の場合はログイン要求を表示する", () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        login: jest.fn(),
        logout: jest.fn(),
        refreshAuth: jest.fn(),
        error: null,
      })

      render(<GamePage />)
      expect(screen.getByText("ログインが必要です")).toBeInTheDocument()
    })

    it("認証済みでゲーム状態の初期ローディング中は読み込み表示をする", async () => {
      // fetchを遅延させてローディング状態をキャッチ
      global.fetch = jest.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                status: 200,
                json: async () => ({
                  success: true,
                  data: { gameState: mockGameState, gameInfo: mockGameInfo },
                }),
              })
            }, 100)
          })
      )

      mockUseAuth.mockReturnValue({
        user: mockAuthUser,
        isAuthenticated: true,
        isLoading: false,
        login: jest.fn(),
        logout: jest.fn(),
        refreshAuth: jest.fn(),
        error: null,
      })

      render(<GamePage />)

      // 初期ローディング状態をチェック
      expect(screen.getByText("読み込み中...")).toBeInTheDocument()

      // ローディング完了を待つ
      await waitFor(() => {
        expect(screen.getByTestId("game-info")).toBeInTheDocument()
      })
    })
  })

  describe("ゲーム状態の初期化", () => {
    it("ゲーム状態を正常に取得して表示する", async () => {
      render(<GamePage />)

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith("/api/game/game1", {
          method: "GET",
          credentials: "include",
        })
      })

      await waitFor(() => {
        expect(screen.getByTestId("game-info")).toBeInTheDocument()
      })

      expect(screen.getByTestId("player-status")).toBeInTheDocument()
    })

    it("ゲーム取得エラー時はエラー状態を表示する", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          error: { message: "サーバーエラーが発生しました" },
        }),
      })

      render(<GamePage />)

      await waitFor(() => {
        expect(screen.getByText("ゲームが見つかりません")).toBeInTheDocument()
      })
    })

    it("ゲームが見つからない場合は適切なメッセージを表示する", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({
          error: { message: "ゲームが見つかりません" },
        }),
      })

      render(<GamePage />)

      await waitFor(() => {
        expect(screen.getByText("ゲームが見つかりません")).toBeInTheDocument()
      })
    })
  })

  describe("ゲームアクション", () => {
    beforeEach(async () => {
      render(<GamePage />)

      await waitFor(() => {
        expect(screen.getByTestId("game-info")).toBeInTheDocument()
      })
    })

    it("ツモボタンをクリックすると点数入力フォームを表示する", () => {
      const tsumoButton = screen.getByText("ツモ")
      fireEvent.click(tsumoButton)

      expect(screen.getByTestId("score-input-form")).toBeInTheDocument()
      expect(screen.getByText("Action: tsumo")).toBeInTheDocument()
    })

    it("ロンボタンをクリックすると点数入力フォームを表示する", () => {
      const ronButton = screen.getByText("ロン")
      fireEvent.click(ronButton)

      expect(screen.getByTestId("score-input-form")).toBeInTheDocument()
      expect(screen.getByText("Action: ron")).toBeInTheDocument()
    })

    it("流局ボタンをクリックすると流局フォームを表示する", () => {
      const ryukyokuButton = screen.getByText("流局")
      fireEvent.click(ryukyokuButton)

      expect(screen.getByTestId("ryukyoku-form")).toBeInTheDocument()
    })

    it("リーチボタンをクリックするとリーチ宣言APIを呼び出す", async () => {
      // リーチ可能な状態にする
      mockUseAuth.mockReturnValue({
        user: { ...mockAuthUser, playerId: "p1" },
        isAuthenticated: true,
        isLoading: false,
        login: jest.fn(),
        logout: jest.fn(),
        refreshAuth: jest.fn(),
        error: null,
      })

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { gameState: mockGameState, gameInfo: mockGameInfo },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        })

      render(<GamePage />)

      await waitFor(() => {
        expect(screen.getByTestId("game-info")).toBeInTheDocument()
      })

      const reachButton = screen.getByText("リーチ")
      fireEvent.click(reachButton)

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith("/api/game/game1/riichi", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId: "p1" }),
          credentials: "include",
        })
      })
    })

    it("強制終了ボタンをクリックすると確認ダイアログを表示する", () => {
      // confirmのモック
      const originalConfirm = window.confirm
      window.confirm = jest.fn(() => false)

      const forceEndButton = screen.getByText("ゲーム強制終了")
      fireEvent.click(forceEndButton)

      expect(window.confirm).toHaveBeenCalledWith("ゲームを強制終了しますか？")

      window.confirm = originalConfirm
    })
  })

  describe("点数入力フォーム", () => {
    beforeEach(async () => {
      render(<GamePage />)

      await waitFor(() => {
        expect(screen.getByTestId("game-info")).toBeInTheDocument()
      })

      const tsumoButton = screen.getByText("ツモ")
      fireEvent.click(tsumoButton)
    })

    it("点数入力フォームで送信すると点数計算APIを呼び出す", async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { gameState: mockGameState, gameInfo: mockGameInfo },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        })

      const submitButton = screen.getByText("Submit Score")
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith("/api/game/game1/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            winnerId: "p1",
            han: 1,
            fu: 30,
            isTsumo: true,
          }),
          credentials: "include",
        })
      })
    })

    it("点数入力フォームでキャンセルするとフォームを閉じる", () => {
      const cancelButton = screen.getByText("Cancel")
      fireEvent.click(cancelButton)

      expect(screen.queryByTestId("score-input-form")).not.toBeInTheDocument()
    })
  })

  describe("流局フォーム", () => {
    beforeEach(async () => {
      render(<GamePage />)

      await waitFor(() => {
        expect(screen.getByTestId("game-info")).toBeInTheDocument()
      })

      const ryukyokuButton = screen.getByText("流局")
      fireEvent.click(ryukyokuButton)
    })

    it("流局フォームで送信すると流局APIを呼び出す", async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { gameState: mockGameState, gameInfo: mockGameInfo },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        })

      const submitButton = screen.getByText("Submit Ryukyoku")
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith("/api/game/game1/ryukyoku", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "流局",
            tenpaiPlayers: ["p1", "p2"],
          }),
          credentials: "include",
        })
      })
    })

    it("流局フォームでキャンセルするとフォームを閉じる", () => {
      const cancelButton = screen.getByText("Cancel")
      fireEvent.click(cancelButton)

      expect(screen.queryByTestId("ryukyoku-form")).not.toBeInTheDocument()
    })
  })

  describe("ゲーム終了", () => {
    it("ゲームが初回ロード時に終了状態の場合はリザルト画面を表示する", async () => {
      const finishedGameState = {
        ...mockGameState,
        gamePhase: "finished" as const,
      }

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            gameState: finishedGameState,
            gameInfo: mockGameInfo,
          },
        }),
      })

      render(<GamePage />)

      await waitFor(() => {
        expect(screen.getByTestId("game-result")).toBeInTheDocument()
      })
    })

    it("ゲーム終了状態でない場合は結果ボタンが表示されない", async () => {
      render(<GamePage />)

      await waitFor(() => {
        expect(screen.getByTestId("game-info")).toBeInTheDocument()
      })

      // ゲームが進行中（finished状態でない）場合は結果ボタンは表示されない
      expect(screen.queryByText("結果を見る")).not.toBeInTheDocument()
    })
  })

  describe("ナビゲーション", () => {
    beforeEach(async () => {
      render(<GamePage />)

      await waitFor(() => {
        expect(screen.getByTestId("game-info")).toBeInTheDocument()
      })
    })

    it("ホームに戻るボタンをクリックするとホームページに遷移する", () => {
      const homeButton = screen.getByText("ホームに戻る")
      fireEvent.click(homeButton)

      expect(mockPush).toHaveBeenCalledWith("/")
    })
  })

  describe("WebSocketエラー", () => {
    beforeEach(async () => {
      render(<GamePage />)

      await waitFor(() => {
        expect(screen.getByTestId("game-info")).toBeInTheDocument()
      })
    })

    it("WebSocketエラーが発生した場合はエラー表示をする", async () => {
      mockUseSocket.mockReturnValue({
        socket: {
          on: jest.fn(),
          off: jest.fn(),
          emit: jest.fn(),
          onAny: jest.fn(),
          offAny: jest.fn(),
          connected: false,
          id: "mock-socket-id",
        } as any,
        isConnected: false,
        error: "接続エラー",
        isReconnecting: false,
        reconnectTimeLeft: 0,
        manualReconnect: mockManualReconnect,
        joinRoom: mockJoinRoom,
      })

      // コンポーネントを再レンダリング
      render(<GamePage />)

      await waitFor(() => {
        expect(screen.getByText("接続エラー")).toBeInTheDocument()
      })
    })

    it("WebSocketエラーのリトライボタンをクリックすると再接続を試行する", async () => {
      mockUseSocket.mockReturnValue({
        socket: {
          on: jest.fn(),
          off: jest.fn(),
          emit: jest.fn(),
          onAny: jest.fn(),
          offAny: jest.fn(),
          connected: false,
          id: "mock-socket-id",
        } as any,
        isConnected: false,
        error: "接続エラー",
        isReconnecting: false,
        reconnectTimeLeft: 0,
        manualReconnect: mockManualReconnect,
        joinRoom: mockJoinRoom,
      })

      render(<GamePage />)

      await waitFor(() => {
        expect(screen.getByText("Retry")).toBeInTheDocument()
      })

      const retryButton = screen.getByText("Retry")
      fireEvent.click(retryButton)

      expect(mockManualReconnect).toHaveBeenCalled()
    })
  })
})
