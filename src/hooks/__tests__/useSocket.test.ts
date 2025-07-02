/* eslint-disable @typescript-eslint/no-require-imports */
import { renderHook, act } from "@testing-library/react"
import { useSocket, useGameEvents } from "../useSocket"

// eslint-disable-next-line no-var
var socketClientMock: any
// eslint-disable-next-line no-var
var eventBus: any
// eslint-disable-next-line no-var
var mockSocket: any

jest.mock("@/lib/socket-client", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { EventEmitter } = require("events")
  const bus = new EventEmitter()
  eventBus = bus
  mockSocket = {
    id: "s1",
    connected: true,
    on: jest.fn((event: string, handler: (...args: any[]) => void) =>
      bus.on(event, handler)
    ),
    off: jest.fn((event: string, handler: (...args: any[]) => void) =>
      bus.off(event, handler)
    ),
    emit: jest.fn(),
    disconnect: jest.fn(),
  }

  const mockHandlers: any = {}

  socketClientMock = {
    connect: jest.fn(() => mockSocket),
    onGameState: jest.fn((cb: any) => {
      mockHandlers.gameState = cb
    }),
    onPlayerConnected: jest.fn((cb: any) => {
      mockHandlers.playerConnected = cb
    }),
    onPlayerJoined: jest.fn((cb: any) => {
      mockHandlers.playerJoined = cb
    }),
    onScoreUpdated: jest.fn((cb: any) => {
      mockHandlers.scoreUpdated = cb
    }),
    onRiichiDeclared: jest.fn((cb: any) => {
      mockHandlers.riichiDeclared = cb
    }),
    onRyukyoku: jest.fn((cb: any) => {
      mockHandlers.ryukyoku = cb
    }),
    onSeatOrderUpdated: jest.fn((cb: any) => {
      mockHandlers.seatOrderUpdated = cb
    }),
    onError: jest.fn((cb: any) => {
      mockHandlers.error = cb
    }),
    onGameStart: jest.fn((cb: any) => {
      mockHandlers.gameStart = cb
    }),
    offGameState: jest.fn(),
    offPlayerConnected: jest.fn(),
    offPlayerJoined: jest.fn(),
    offScoreUpdated: jest.fn(),
    offRiichiDeclared: jest.fn(),
    offRyukyoku: jest.fn(),
    offSeatOrderUpdated: jest.fn(),
    offError: jest.fn(),
    offGameStart: jest.fn(),
    joinRoom: jest.fn(),
    setReady: jest.fn(),
    calculateScore: jest.fn(),
    declareReach: jest.fn(),
    declareRyukyoku: jest.fn(),
    handlers: mockHandlers,
  }
  return { socketClient: socketClientMock }
})

describe("useSocket", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    eventBus.removeAllListeners()
    mockSocket.connected = true

    // ハンドラーをリセット
    Object.keys(socketClientMock.handlers).forEach((key) => {
      delete socketClientMock.handlers[key]
    })
  })

  describe("基本的な接続機能", () => {
    test("初期化時にソケットに接続する", () => {
      renderHook(() => useSocket())
      expect(socketClientMock.connect).toHaveBeenCalled()
    })

    test("接続時に状態を正しく更新する", () => {
      const { result } = renderHook(() => useSocket())

      act(() => {
        eventBus.emit("connect")
      })

      expect(result.current.isConnected).toBe(true)
      expect(result.current.error).toBeNull()
      expect(result.current.connectionAttempts).toBe(0)
      expect(result.current.isReconnecting).toBe(false)
      expect(result.current.reconnectTimeLeft).toBe(0)
    })

    test("コンポーネントアンマウント時にソケットを切断する", () => {
      const { unmount } = renderHook(() => useSocket())
      unmount()
      expect(mockSocket.disconnect).toHaveBeenCalled()
    })
  })

  describe("ゲーム状態の管理", () => {
    test("ゲーム状態イベントを受信して状態を更新する", () => {
      const { result } = renderHook(() => useSocket())

      const gameState = {
        gameId: "game123",
        players: [
          {
            playerId: "player1",
            name: "プレイヤー1",
            position: 0,
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

      act(() => {
        socketClientMock.handlers.gameState?.(gameState)
      })

      expect(result.current.gameState).toEqual(gameState)
    })

    test("プレイヤー接続イベントでゲーム状態を更新する", () => {
      const { result } = renderHook(() => useSocket())

      const playerConnectedData = {
        playerId: "player1",
        name: "プレイヤー1",
        gameState: {
          gameId: "game123",
          players: [],
          currentRound: 1,
          currentOya: 0,
          honba: 0,
          kyotaku: 0,
          gamePhase: "playing" as const,
        },
      }

      act(() => {
        socketClientMock.handlers.playerConnected?.(playerConnectedData)
      })

      expect(result.current.gameState).toEqual(playerConnectedData.gameState)
    })

    test("プレイヤー参加イベントでゲーム状態を更新する", () => {
      const { result } = renderHook(() => useSocket())

      const playerJoinedData = {
        playerId: "player2",
        name: "プレイヤー2",
        gameState: {
          gameId: "game123",
          players: [],
          currentRound: 1,
          currentOya: 0,
          honba: 0,
          kyotaku: 0,
          gamePhase: "waiting" as const,
        },
      }

      act(() => {
        socketClientMock.handlers.playerJoined?.(playerJoinedData)
      })

      expect(result.current.gameState).toEqual(playerJoinedData.gameState)
    })

    test("スコア更新イベントでゲーム状態を更新する", () => {
      const { result } = renderHook(() => useSocket())

      const scoreUpdatedData = {
        gameId: "game123",
        winnerId: "player1",
        han: 3,
        fu: 30,
        gameState: {
          gameId: "game123",
          players: [],
          currentRound: 2,
          currentOya: 1,
          honba: 0,
          kyotaku: 0,
          gamePhase: "playing" as const,
        },
      }

      act(() => {
        socketClientMock.handlers.scoreUpdated?.(scoreUpdatedData)
      })

      expect(result.current.gameState).toEqual(scoreUpdatedData.gameState)
    })

    test("リーチ宣言イベントでゲーム状態を更新する", () => {
      const { result } = renderHook(() => useSocket())

      const riichiData = {
        gameId: "game123",
        playerId: "player1",
        gameState: {
          gameId: "game123",
          players: [],
          currentRound: 1,
          currentOya: 0,
          honba: 0,
          kyotaku: 1,
          gamePhase: "playing" as const,
        },
      }

      act(() => {
        socketClientMock.handlers.riichiDeclared?.(riichiData)
      })

      expect(result.current.gameState).toEqual(riichiData.gameState)
    })

    test("流局イベントでゲーム状態を更新する", () => {
      const { result } = renderHook(() => useSocket())

      const ryukyokuData = {
        gameId: "game123",
        reason: "九種九牌",
        tenpaiPlayers: ["player1"],
        gameState: {
          gameId: "game123",
          players: [],
          currentRound: 2,
          currentOya: 0,
          honba: 1,
          kyotaku: 0,
          gamePhase: "playing" as const,
        },
      }

      act(() => {
        socketClientMock.handlers.ryukyoku?.(ryukyokuData)
      })

      expect(result.current.gameState).toEqual(ryukyokuData.gameState)
    })

    test("席順更新イベントでゲーム状態を更新する", () => {
      const { result } = renderHook(() => useSocket())

      const seatOrderData = {
        gameState: {
          gameId: "game123",
          players: [],
          currentRound: 1,
          currentOya: 0,
          honba: 0,
          kyotaku: 0,
          gamePhase: "waiting" as const,
        },
      }

      act(() => {
        socketClientMock.handlers.seatOrderUpdated?.(seatOrderData)
      })

      expect(result.current.gameState).toEqual(seatOrderData.gameState)
    })
  })

  describe("エラーハンドリング", () => {
    test("接続エラーが発生した場合にエラー状態を設定し再接続を試行する", () => {
      jest.useFakeTimers()
      const { result } = renderHook(() => useSocket())

      act(() => {
        eventBus.emit("connect_error", new Error("Connection failed"))
      })

      expect(result.current.isConnected).toBe(false)
      expect(result.current.error).toBe(
        "接続エラーが発生しました。再接続を試行中..."
      )
      expect(result.current.isReconnecting).toBe(true)

      jest.useRealTimers()
    })

    test("ソケットエラーイベントでエラー状態を設定する", () => {
      const { result } = renderHook(() => useSocket())

      const errorData = {
        message: "何らかのエラーが発生しました",
        code: "ERROR_CODE",
      }

      act(() => {
        socketClientMock.handlers.error?.(errorData)
      })

      expect(result.current.error).toBe("何らかのエラーが発生しました")
    })

    test("エラーメッセージがない場合にデフォルトメッセージを使用する", () => {
      const { result } = renderHook(() => useSocket())

      act(() => {
        socketClientMock.handlers.error?.({})
      })

      expect(result.current.error).toBe("通信エラーが発生しました")
    })
  })

  describe("切断と再接続", () => {
    test("意図的でない切断の場合に再接続を試行する", () => {
      jest.useFakeTimers()
      const { result } = renderHook(() => useSocket())

      act(() => {
        eventBus.emit("disconnect", "transport close")
      })

      expect(result.current.isConnected).toBe(false)
      expect(result.current.error).toBe(
        "接続が切断されました。再接続を試行中..."
      )
      expect(result.current.isReconnecting).toBe(true)

      jest.useRealTimers()
    })

    test("意図的な切断の場合は再接続を試行しない", () => {
      const { result } = renderHook(() => useSocket())

      act(() => {
        eventBus.emit("disconnect", "io client disconnect")
      })

      expect(result.current.isConnected).toBe(false)
      expect(result.current.isReconnecting).toBe(false)
    })

    test("サーバーによる切断の場合は再接続を試行しない", () => {
      const { result } = renderHook(() => useSocket())

      act(() => {
        eventBus.emit("disconnect", "io server disconnect")
      })

      expect(result.current.isConnected).toBe(false)
      expect(result.current.isReconnecting).toBe(false)
    })

    test("再接続の指数バックオフとカウントダウンが正しく動作する", () => {
      jest.useFakeTimers()
      const { result } = renderHook(() => useSocket())

      // 最初の接続失敗
      act(() => {
        eventBus.emit("disconnect", "transport close")
      })

      expect(result.current.reconnectTimeLeft).toBe(2) // 2秒のカウントダウン

      // 1秒経過
      act(() => {
        jest.advanceTimersByTime(1000)
      })

      expect(result.current.reconnectTimeLeft).toBe(1)

      // さらに1秒経過して再接続試行
      act(() => {
        jest.advanceTimersByTime(1000)
      })

      expect(socketClientMock.connect).toHaveBeenCalledTimes(2)
      expect(result.current.connectionAttempts).toBe(1)

      jest.useRealTimers()
    })

    test("最大試行回数に達した場合は再接続を停止する", () => {
      jest.useFakeTimers()
      const { result } = renderHook(() => useSocket())

      // 5回の失敗をシミュレート
      for (let i = 0; i < 6; i++) {
        act(() => {
          eventBus.emit("disconnect", "transport close")
        })
        act(() => {
          jest.advanceTimersByTime(10000) // 十分な時間を進める
        })
      }

      expect(result.current.error).toBe(
        "接続に失敗しました。ページを再読み込みしてください。"
      )
      expect(result.current.isReconnecting).toBe(false)

      jest.useRealTimers()
    })
  })

  describe("手動再接続", () => {
    test("手動再接続で状態をリセットして新しい接続を作成する", () => {
      const { result } = renderHook(() => useSocket())

      // エラー状態を設定
      act(() => {
        eventBus.emit("disconnect", "transport close")
      })

      act(() => {
        result.current.manualReconnect()
      })

      expect(result.current.connectionAttempts).toBe(0)
      expect(result.current.error).toBeNull()
      expect(result.current.isReconnecting).toBe(false)
      expect(mockSocket.disconnect).toHaveBeenCalled()
      expect(socketClientMock.connect).toHaveBeenCalledTimes(2)
    })
  })

  describe("ルーム参加機能", () => {
    test("接続済みの場合は即座にルーム参加する", () => {
      const { result } = renderHook(() => useSocket())

      act(() => {
        eventBus.emit("connect")
      })

      act(() => {
        result.current.joinRoom("ROOM123", "player1")
      })

      expect(socketClientMock.joinRoom).toHaveBeenCalledWith(
        "ROOM123",
        "player1"
      )
    })

    test("未接続の場合は遅延してルーム参加する", () => {
      jest.useFakeTimers()
      mockSocket.connected = false
      const { result } = renderHook(() => useSocket())

      act(() => {
        result.current.joinRoom("ROOM123", "player1")
      })

      expect(socketClientMock.joinRoom).not.toHaveBeenCalled()

      // ソケットを接続状態にして時間を進める
      mockSocket.connected = true
      act(() => {
        jest.advanceTimersByTime(1000)
      })

      expect(socketClientMock.joinRoom).toHaveBeenCalledWith(
        "ROOM123",
        "player1"
      )

      jest.useRealTimers()
    })

    test("遅延後もソケットが未接続の場合はエラーログを出力する", () => {
      jest.useFakeTimers()
      const consoleSpy = jest.spyOn(console, "error").mockImplementation()
      mockSocket.connected = false
      const { result } = renderHook(() => useSocket())

      act(() => {
        result.current.joinRoom("ROOM123", "player1")
      })

      act(() => {
        jest.advanceTimersByTime(1000)
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        "🏠 Socket still not connected after delay"
      )

      consoleSpy.mockRestore()
      jest.useRealTimers()
    })
  })

  describe("ゲームアクション", () => {
    test("setReadyが正しく呼び出される", () => {
      const { result } = renderHook(() => useSocket())

      act(() => {
        result.current.setReady("game123", "player1")
      })

      expect(socketClientMock.setReady).toHaveBeenCalledWith(
        "game123",
        "player1"
      )
    })

    test("calculateScoreが正しく呼び出される", () => {
      const { result } = renderHook(() => useSocket())

      const scoreData = {
        gameId: "game123",
        winnerId: "player1",
        han: 3,
        fu: 30,
        isTsumo: true,
        loserId: "player2",
      }

      act(() => {
        result.current.calculateScore(scoreData)
      })

      expect(socketClientMock.calculateScore).toHaveBeenCalledWith(scoreData)
    })

    test("declareReachが正しく呼び出される", () => {
      const { result } = renderHook(() => useSocket())

      act(() => {
        result.current.declareReach("game123", "player1")
      })

      expect(socketClientMock.declareReach).toHaveBeenCalledWith(
        "game123",
        "player1"
      )
    })

    test("declareRyukyokuが正しく呼び出される", () => {
      const { result } = renderHook(() => useSocket())

      act(() => {
        result.current.declareRyukyoku("game123", "九種九牌", [
          "player1",
          "player2",
        ])
      })

      expect(socketClientMock.declareRyukyoku).toHaveBeenCalledWith(
        "game123",
        "九種九牌",
        ["player1", "player2"]
      )
    })

    test("declareRyukyokuでデフォルト値が使用される", () => {
      const { result } = renderHook(() => useSocket())

      act(() => {
        result.current.declareRyukyoku("game123", "九種九牌")
      })

      expect(socketClientMock.declareRyukyoku).toHaveBeenCalledWith(
        "game123",
        "九種九牌",
        []
      )
    })
  })

  describe("イベントハンドラーのクリーンアップ", () => {
    test("コンポーネントアンマウント時にイベントハンドラーが正しく削除される", () => {
      const { unmount } = renderHook(() => useSocket())

      unmount()

      expect(mockSocket.off).toHaveBeenCalledWith(
        "connect",
        expect.any(Function)
      )
      expect(mockSocket.off).toHaveBeenCalledWith(
        "disconnect",
        expect.any(Function)
      )
      expect(mockSocket.off).toHaveBeenCalledWith(
        "connect_error",
        expect.any(Function)
      )
      expect(mockSocket.off).toHaveBeenCalledWith("error", expect.any(Function))
      expect(socketClientMock.offGameState).toHaveBeenCalled()
      expect(socketClientMock.offPlayerConnected).toHaveBeenCalled()
      expect(socketClientMock.offPlayerJoined).toHaveBeenCalled()
      expect(socketClientMock.offScoreUpdated).toHaveBeenCalled()
      expect(socketClientMock.offRiichiDeclared).toHaveBeenCalled()
      expect(socketClientMock.offRyukyoku).toHaveBeenCalled()
      expect(socketClientMock.offSeatOrderUpdated).toHaveBeenCalled()
      expect(socketClientMock.offError).toHaveBeenCalled()
    })
  })
})

describe("useGameEvents", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Object.keys(socketClientMock.handlers).forEach((key) => {
      delete socketClientMock.handlers[key]
    })
  })

  test("スコア更新イベントを処理する", () => {
    const { result } = renderHook(() => useGameEvents())

    const scoreUpdateData = {
      gameId: "game123",
      winnerId: "player1",
      han: 3,
      fu: 30,
      gameState: {
        gameId: "game123",
        players: [],
        currentRound: 1,
        currentOya: 0,
        honba: 0,
        kyotaku: 0,
        gamePhase: "playing" as const,
      },
    }

    act(() => {
      socketClientMock.handlers.scoreUpdated?.(scoreUpdateData)
    })

    expect(result.current.scoreUpdate).toEqual(scoreUpdateData)
  })

  test("ゲーム開始イベントを処理する", () => {
    const { result } = renderHook(() => useGameEvents())

    act(() => {
      socketClientMock.handlers.gameStart?.()
    })

    expect(result.current.gameStarted).toBe(true)
  })

  test("初期状態が正しく設定される", () => {
    const { result } = renderHook(() => useGameEvents())

    expect(result.current.scoreUpdate).toBeNull()
    expect(result.current.gameStarted).toBe(false)
  })

  test("コンポーネントアンマウント時にイベントハンドラーが削除される", () => {
    const { unmount } = renderHook(() => useGameEvents())

    unmount()

    expect(socketClientMock.offScoreUpdated).toHaveBeenCalled()
    expect(socketClientMock.offGameStart).toHaveBeenCalled()
  })
})
