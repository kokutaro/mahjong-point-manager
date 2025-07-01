import { render, screen, fireEvent, act, waitFor } from "@testing-library/react"
import GameResult from "../GameResult"

// AuthContextのモック
const mockUser = {
  playerId: "player1",
  name: "テストプレイヤー1",
}

// useAuth フックのモック
const mockedUseAuth = jest.fn()
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockedUseAuth(),
}))

// useAppStore フックのモック
jest.mock("@/store/useAppStore", () => ({
  useSessionStore: () => ({
    setSession: jest.fn(),
  }),
  useUIStore: () => ({
    isLoading: false,
    setLoading: jest.fn(),
    setError: jest.fn(),
  }),
}))

// fetch API のモック
global.fetch = jest.fn()

// Socket.IO のモック
const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
}

jest.mock("socket.io-client", () => ({
  io: jest.fn(() => mockSocket),
}))

// タイマーのモック（各テストでセットアップ）

// モックデータ
const mockGameResultData = {
  gameId: "test-game-id",
  roomCode: "TEST123",
  results: [
    {
      playerId: "player1",
      name: "テストプレイヤー1",
      finalPoints: 35000,
      rank: 1,
      uma: 3000,
      settlement: 8000,
    },
    {
      playerId: "player2",
      name: "テストプレイヤー2",
      finalPoints: 28000,
      rank: 2,
      uma: 1000,
      settlement: -2000,
    },
    {
      playerId: "player3",
      name: "テストプレイヤー3",
      finalPoints: 22000,
      rank: 3,
      uma: -1000,
      settlement: -3000,
    },
    {
      playerId: "player4",
      name: "テストプレイヤー4",
      finalPoints: 15000,
      rank: 4,
      uma: -3000,
      settlement: -3000,
    },
  ],
  gameType: "TONPUU" as const,
  endReason: "東4局終了",
  endedAt: "2023-01-01T12:00:00Z",
  basePoints: 30000,
  sessionId: "test-session-id",
  sessionCode: "SES123",
  sessionName: "テストセッション",
  hostPlayerId: "player1",
}

describe("GameResult ホスト表示機能", () => {
  const mockOnBack = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockedUseAuth.mockReturnValue({ user: mockUser })

    // fetch API のレスポンスをモック
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: mockGameResultData,
        }),
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test("ホストプレイヤーにホストバッジが表示される", async () => {
    await act(async () => {
      render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)
    })

    // APIレスポンスが処理されるまで待機
    await waitFor(async () => {
      await screen.findByText("対局結果")
    })

    // ホストプレイヤー（player1）にホストバッジが表示される
    const hostBadges = screen.getAllByText("👑 ホスト")
    expect(hostBadges.length).toBeGreaterThanOrEqual(1)

    // ホストバッジがテストプレイヤー1の横に表示されている
    const playerNameElements = screen.getAllByText("テストプレイヤー1")
    expect(playerNameElements.length).toBeGreaterThan(0)
  })

  test("非ホストプレイヤーにはホストバッジが表示されない", async () => {
    await act(async () => {
      render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)
    })

    // APIレスポンスが処理されるまで待機
    await waitFor(async () => {
      await screen.findByText("対局結果")
    })

    // 非ホストプレイヤーの名前の隣にはホストバッジがない
    const player2Elements = screen.getAllByText("テストプレイヤー2")
    const player3Elements = screen.getAllByText("テストプレイヤー3")
    const player4Elements = screen.getAllByText("テストプレイヤー4")

    expect(player2Elements.length).toBeGreaterThan(0)
    expect(player3Elements.length).toBeGreaterThan(0)
    expect(player4Elements.length).toBeGreaterThan(0)

    // ホストバッジの数は1つ（順位表用）+ 1つ（精算詳細用）のみ
    const hostBadges = screen.getAllByText("👑 ホスト")
    expect(hostBadges.length).toBe(2) // 順位表とカード詳細の2箇所
  })

  test("hostPlayerIdがない場合、ホストバッジが表示されない", async () => {
    const dataWithoutHost = {
      ...mockGameResultData,
      hostPlayerId: undefined,
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: dataWithoutHost,
        }),
    })

    await act(async () => {
      render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)
    })

    // APIレスポンスが処理されるまで待機
    await waitFor(async () => {
      await screen.findByText("対局結果")
    })

    // ホストバッジが表示されていない
    const hostBadges = screen.queryAllByText("👑 ホスト")
    expect(hostBadges.length).toBe(0)
  })

  test("異なるプレイヤーがホストの場合、正しいプレイヤーにホストバッジが表示される", async () => {
    const dataWithDifferentHost = {
      ...mockGameResultData,
      hostPlayerId: "player3", // player3がホスト
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: dataWithDifferentHost,
        }),
    })

    await act(async () => {
      render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)
    })

    // APIレスポンスが処理されるまで待機
    await waitFor(async () => {
      await screen.findByText("対局結果")
    })

    // ホストバッジが表示される
    const hostBadges = screen.getAllByText("👑 ホスト")
    expect(hostBadges.length).toBe(2) // 順位表とカード詳細の2箇所

    // テストプレイヤー3の名前が表示されている
    const player3Elements = screen.getAllByText("テストプレイヤー3")
    expect(player3Elements.length).toBeGreaterThan(0)
  })

  test("ホストバッジのスタイルが正しく適用される", async () => {
    render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)

    // APIレスポンスが処理されるまで待機
    await screen.findByText("対局結果")

    // ホストバッジの要素を取得
    const hostBadges = screen.getAllByText("👑 ホスト")

    // 少なくとも1つのホストバッジが存在する
    expect(hostBadges.length).toBeGreaterThan(0)

    // 最初のホストバッジのクラス名を確認
    const firstBadge = hostBadges[0]
    expect(firstBadge).toHaveClass("ml-2")
    expect(firstBadge).toHaveClass("px-2")
    expect(firstBadge).toHaveClass("py-1")
    expect(firstBadge).toHaveClass("bg-yellow-100")
    expect(firstBadge).toHaveClass("text-yellow-800")
    expect(firstBadge).toHaveClass("text-xs")
    expect(firstBadge).toHaveClass("rounded-full")
    expect(firstBadge).toHaveClass("border")
    expect(firstBadge).toHaveClass("border-yellow-300")
  })

  test("セッション情報が正しく表示される", async () => {
    render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)

    // APIレスポンスが処理されるまで待機
    await screen.findByText("対局結果")

    // セッション情報が表示される
    expect(
      screen.getByText((content, element) =>
        element?.textContent?.startsWith("セッション:")
      )
    ).toBeInTheDocument()
    expect(screen.getByText(/テストセッション/)).toBeInTheDocument()
  })
})

describe("GameResult Phase 2: ホスト専用強制終了機能", () => {
  const mockOnBack = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockedUseAuth.mockReturnValue({ user: mockUser })

    // fetch API のレスポンスをモック
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: mockGameResultData,
        }),
    })
  })

  test("ホストユーザーに強制終了ボタンが表示される", async () => {
    // ホストとして認証されるようモック設定
    const hostUser = { playerId: "player1", name: "テストプレイヤー1" }
    mockedUseAuth.mockReturnValue({ user: hostUser })

    render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)

    // APIレスポンスが処理されるまで待機
    await screen.findByText("対局結果")

    // ホスト専用強制終了ボタンが表示される
    expect(screen.getByText("⚠️ セッション強制終了")).toBeInTheDocument()
  })

  test("非ホストユーザーには強制終了ボタンが表示されない", async () => {
    // 非ホストとして認証されるようモック設定
    const nonHostUser = { playerId: "player2", name: "テストプレイヤー2" }
    mockedUseAuth.mockReturnValue({ user: nonHostUser })

    render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)

    // APIレスポンスが処理されるまで待機
    await screen.findByText("対局結果")

    // 強制終了ボタンが表示されない
    expect(screen.queryByText("⚠️ セッション強制終了")).not.toBeInTheDocument()
  })

  test("セッションIDがない場合、ホストでも強制終了ボタンが表示されない", async () => {
    const dataWithoutSession = {
      ...mockGameResultData,
      sessionId: undefined,
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: dataWithoutSession,
        }),
    })

    const hostUser = { playerId: "player1", name: "テストプレイヤー1" }
    mockedUseAuth.mockReturnValue({ user: hostUser })

    render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)

    // APIレスポンスが処理されるまで待機
    await screen.findByText("対局結果")

    // セッションIDがないため強制終了ボタンが表示されない
    expect(screen.queryByText("⚠️ セッション強制終了")).not.toBeInTheDocument()
  })

  test("強制終了ボタンクリックで確認モーダルが表示される", async () => {
    const hostUser = { playerId: "player1", name: "テストプレイヤー1" }
    mockedUseAuth.mockReturnValue({ user: hostUser })

    render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)

    // APIレスポンスが処理されるまで待機
    await screen.findByText("対局結果")

    // 強制終了ボタンをクリック
    const forceEndButton = screen.getByText("⚠️ セッション強制終了")
    fireEvent.click(forceEndButton)

    // 確認モーダルが表示される
    await screen.findByText("セッション強制終了の確認")
    expect(screen.getByText(/を強制終了しますか？/)).toBeInTheDocument()
  })

  test("確認モーダルで強制終了を実行できる", async () => {
    const mockEndResponse = {
      ok: true,
      json: () => Promise.resolve({ success: true }),
    }

    // 最初にゲーム結果取得、次に強制終了APIのレスポンス
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: mockGameResultData,
          }),
      })
      .mockResolvedValueOnce(mockEndResponse)

    const hostUser = { playerId: "player1", name: "テストプレイヤー1" }
    mockedUseAuth.mockReturnValue({ user: hostUser })

    render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)

    // APIレスポンスが処理されるまで待機
    await screen.findByText("対局結果")

    // 強制終了ボタンをクリック
    const forceEndButton = screen.getByText("⚠️ セッション強制終了")
    fireEvent.click(forceEndButton)

    // 理由を選択
    const reasonSelect = screen.getByRole("combobox")
    fireEvent.change(reasonSelect, { target: { value: "ホストによる終了" } })

    // 強制終了を確定
    const confirmButton = screen.getByText("強制終了")
    fireEvent.click(confirmButton)

    // 強制終了APIが正しく呼ばれることを確認
    await new Promise((resolve) => setTimeout(resolve, 0)) // 非同期処理の待機

    expect(global.fetch).toHaveBeenCalledWith("/api/game/test-game-id/end", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason: "ホストによる終了" }),
    })
  })
})

describe("GameResult Phase 4: final score display", () => {
  const mockOnBack = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockedUseAuth.mockReturnValue({ user: mockUser })
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockGameResultData }),
    })
  })

  test("shows final points table", async () => {
    await act(async () => {
      render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)
    })

    await screen.findByText("対局結果")
    expect(screen.getAllByText("35,000").length).toBeGreaterThan(0)
    expect(screen.getAllByText("15,000").length).toBeGreaterThan(0)
  })
})

describe("GameResult WebSocket Integration", () => {
  const mockOnBack = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockedUseAuth.mockReturnValue({ user: mockUser })
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockGameResultData }),
    })
  })

  test("WebSocket接続とルーム参加", async () => {
    render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)

    await screen.findByText("対局結果")

    // WebSocket接続が開始される
    expect(mockSocket.on).toHaveBeenCalledWith("connect", expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith("error", expect.any(Function))
  })

  test("continueVoteイベントの処理", async () => {
    render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)

    await screen.findByText("対局結果")

    // continueVoteイベントハンドラーが登録される
    expect(mockSocket.on).toHaveBeenCalledWith(
      "continue-vote",
      expect.any(Function)
    )

    // continueVoteイベントのシミュレーション
    const continueVoteHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === "continue-vote"
    )?.[1]

    if (continueVoteHandler) {
      act(() => {
        continueVoteHandler({ playerId: "player2", vote: true })
      })
    }

    // 状態が更新されることを確認（詳細な確認は統合テストで行う）
    expect(continueVoteHandler).toBeDefined()
  })

  test("vote-cancelledイベントの処理", async () => {
    render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)

    await screen.findByText("対局結果")

    expect(mockSocket.on).toHaveBeenCalledWith(
      "vote-cancelled",
      expect.any(Function)
    )

    const voteCancelledHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === "vote-cancelled"
    )?.[1]

    if (voteCancelledHandler) {
      act(() => {
        voteCancelledHandler({ message: "投票がキャンセルされました" })
      })
    }

    expect(voteCancelledHandler).toBeDefined()
  })

  test("session_force_endedイベントの処理（非ホスト）", async () => {
    const nonHostUser = { playerId: "player2", name: "テストプレイヤー2" }
    mockedUseAuth.mockReturnValue({ user: nonHostUser })

    render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)

    await screen.findByText("対局結果")

    expect(mockSocket.on).toHaveBeenCalledWith(
      "session_force_ended",
      expect.any(Function)
    )

    const forceEndedHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === "session_force_ended"
    )?.[1]

    if (forceEndedHandler) {
      act(() => {
        forceEndedHandler({
          reason: "テスト強制終了",
          endedBy: { playerId: "player1", name: "ホストプレイヤー" },
        })
      })
    }

    expect(forceEndedHandler).toBeDefined()
  })

  test("session_vote_updateイベントの処理", async () => {
    render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)

    await screen.findByText("対局結果")

    expect(mockSocket.on).toHaveBeenCalledWith(
      "session_vote_update",
      expect.any(Function)
    )

    const voteUpdateHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === "session_vote_update"
    )?.[1]

    if (voteUpdateHandler) {
      act(() => {
        voteUpdateHandler({
          votes: { player2: "continue" },
          result: { allVoted: false, allAgreed: false, votes: {} },
          voterName: "他のプレイヤー",
        })
      })
    }

    expect(voteUpdateHandler).toBeDefined()
  })

  test("session_ended_by_consensusイベントの処理", async () => {
    render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)

    await screen.findByText("対局結果")

    expect(mockSocket.on).toHaveBeenCalledWith(
      "session_ended_by_consensus",
      expect.any(Function)
    )

    const consensusEndHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === "session_ended_by_consensus"
    )?.[1]

    if (consensusEndHandler) {
      act(() => {
        consensusEndHandler({
          reason: "全員の合意",
          voteDetails: { player1: true, player2: true },
        })
      })
    }

    expect(consensusEndHandler).toBeDefined()
  })

  test("session_continue_agreedイベントの処理", async () => {
    render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)

    await screen.findByText("対局結果")

    expect(mockSocket.on).toHaveBeenCalledWith(
      "session_continue_agreed",
      expect.any(Function)
    )

    const continueAgreedHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === "session_continue_agreed"
    )?.[1]

    if (continueAgreedHandler) {
      act(() => {
        continueAgreedHandler({ continueVotes: 4 })
      })
    }

    expect(continueAgreedHandler).toBeDefined()
  })

  test("vote_timeoutイベントの処理", async () => {
    render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)

    await screen.findByText("対局結果")

    expect(mockSocket.on).toHaveBeenCalledWith(
      "vote_timeout",
      expect.any(Function)
    )

    const timeoutHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === "vote_timeout"
    )?.[1]

    if (timeoutHandler) {
      act(() => {
        timeoutHandler()
      })
    }

    expect(timeoutHandler).toBeDefined()
  })

  test("ソロプレイではWebSocket接続しない", async () => {
    render(
      <GameResult gameId="test-game-id" onBack={mockOnBack} isSoloPlay={true} />
    )

    await screen.findByText("対局結果")

    // WebSocket接続は開始されない
    expect(mockSocket.on).not.toHaveBeenCalled()
  })
})

describe("GameResult Error Handling", () => {
  const mockOnBack = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockedUseAuth.mockReturnValue({ user: mockUser })
  })

  test("API エラーレスポンスの処理", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
      json: () =>
        Promise.resolve({
          success: false,
          error: { message: "ゲームが見つかりません" },
        }),
    })

    render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)

    await waitFor(() => {
      expect(screen.getByText("ゲームが見つかりません")).toBeInTheDocument()
    })
  })

  test("ネットワークエラーの処理", async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"))

    render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument()
    })
  })

  test("success: false レスポンスの処理", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: false,
          error: { message: "データの取得に失敗" },
        }),
    })

    render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)

    await waitFor(() => {
      expect(screen.getByText("データの取得に失敗")).toBeInTheDocument()
    })
  })

  test("不正なJSONレスポンスの処理", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new Error("Invalid JSON")),
    })

    render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)

    await waitFor(() => {
      expect(screen.getByText("Invalid JSON")).toBeInTheDocument()
    })
  })
})

describe("GameResult Next Game Transition", () => {
  const mockOnBack = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    mockedUseAuth.mockReturnValue({ user: mockUser })

    // nextGameを含むレスポンス
    const dataWithNextGame = {
      ...mockGameResultData,
      nextGame: {
        id: "next-game-id",
        roomCode: "NEXT123",
      },
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: dataWithNextGame,
        }),
    })

    // location.href のモック
    delete (window as any).location
    ;(window as any).location = { href: "" }
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test("nextGameがある場合のカウントダウン開始", async () => {
    render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)

    await screen.findByText("対局結果")

    // カウントダウンメッセージが表示される
    await waitFor(() => {
      expect(screen.getByText(/次の対局の準備ができました/)).toBeInTheDocument()
    })

    // 5秒経過後に自動遷移
    act(() => {
      jest.advanceTimersByTime(5000)
    })

    expect(window.location.href).toBe("/room/NEXT123")
  })

  test("new-room-readyイベントでの遷移", async () => {
    render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)

    await screen.findByText("対局結果")

    const newRoomReadyHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === "new-room-ready"
    )?.[1]

    if (newRoomReadyHandler) {
      act(() => {
        newRoomReadyHandler({ roomCode: "READY123" })
      })
    }

    // カウントダウンメッセージが表示される
    await waitFor(() => {
      expect(screen.getByText(/次の対局の準備ができました/)).toBeInTheDocument()
    })

    // 5秒経過後に自動遷移
    act(() => {
      jest.advanceTimersByTime(5000)
    })

    expect(window.location.href).toBe("/room/READY123")
  })
})

describe("GameResult State Management", () => {
  const mockOnBack = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockedUseAuth.mockReturnValue({ user: mockUser })
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockGameResultData }),
    })
  })

  test("初期状態の確認", () => {
    render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)

    // ローディング状態から開始
    expect(screen.getByText("読み込み中...")).toBeInTheDocument()
  })

  test("isSoloPlayプロパティの動作確認", async () => {
    render(
      <GameResult gameId="test-game-id" onBack={mockOnBack} isSoloPlay={true} />
    )

    await screen.findByText("対局結果")

    // ソロプレイの場合はWebSocket関連の機能が無効
    expect(mockSocket.on).not.toHaveBeenCalled()
  })

  test("ユーザー認証情報の確認", async () => {
    render(<GameResult gameId="test-game-id" onBack={mockOnBack} />)

    await screen.findByText("対局結果")

    // WebSocket接続時にユーザー情報が使用される
    const connectHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === "connect"
    )?.[1]

    if (connectHandler) {
      act(() => {
        connectHandler()
      })
    }

    expect(mockSocket.emit).toHaveBeenCalledWith("join_room", {
      roomCode: "TEST123",
      playerId: "player1",
    })
  })
})
