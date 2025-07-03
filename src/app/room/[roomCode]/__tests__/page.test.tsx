import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { useParams, useRouter } from "next/navigation"
import RoomPage from "../page"
import { useAuth } from "@/contexts/AuthContext"
import { useSocket } from "@/hooks/useSocket"
import { useMediaQuery } from "@mantine/hooks"

// QRCodeSVGをモック
jest.mock("qrcode.react", () => ({
  QRCodeSVG: ({ value, size }: { value: string; size: number }) => (
    <div data-testid="qr-code-svg" data-value={value} data-size={size}>
      QR Code: {value}
    </div>
  ),
}))

// QRCodeModalをモック
jest.mock("@/components/QRCodeModal", () => {
  return function QRCodeModal({
    isOpen,
    onClose,
    qrCodeData,
  }: {
    isOpen: boolean
    onClose: () => void
    qrCodeData: string
  }) {
    if (!isOpen) return null
    return (
      <div data-testid="qr-code-modal">
        <span>QR Code Data: {qrCodeData}</span>
        <button onClick={onClose}>Close</button>
      </div>
    )
  }
})

// framer-motionのReorderをモック
jest.mock("framer-motion", () => ({
  Reorder: {
    Group: ({ children, ...props }: any) => (
      <div data-testid="reorder-group" {...props}>
        {children}
      </div>
    ),
    Item: ({ children, value, ...props }: any) => (
      <div data-testid="reorder-item" data-value={value?.playerId} {...props}>
        {children}
      </div>
    ),
  },
}))

// utilsモック
jest.mock("@/lib/utils", () => ({
  getPositionName: (position: number) => {
    const names = ["東", "南", "西", "北"]
    return names[position] || "?"
  },
}))

// Next.js navigation hooks をモック
jest.mock("next/navigation", () => ({
  useParams: jest.fn(),
  useRouter: jest.fn(),
}))

// AuthContextをモック
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}))

// useSocketをモック
jest.mock("@/hooks/useSocket", () => ({
  useSocket: jest.fn(),
}))

// MantineのuseMediaQueryをモック
jest.mock("@mantine/hooks", () => ({
  useMediaQuery: jest.fn(),
}))

// fetch をモック
global.fetch = jest.fn()

const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockJoinRoom = jest.fn()

// window.location のモックは削除（JSDOM環境では複雑なため）

describe("RoomPage", () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // デフォルトのモック設定
    ;(useParams as jest.Mock).mockReturnValue({
      roomCode: "ABCD1234",
    })
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      replace: mockReplace,
    })
    ;(useMediaQuery as jest.Mock).mockReturnValue(true) // デスクトップ表示

    // デフォルトのSocket設定
    ;(useSocket as jest.Mock).mockReturnValue({
      socket: {
        id: "socket-id",
        on: jest.fn(),
        off: jest.fn(),
      },
      isConnected: true,
      joinRoom: mockJoinRoom,
      gameState: null,
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe("認証状態による表示制御", () => {
    it("未認証時にリダイレクト画面を表示する", () => {
      ;(useAuth as jest.Mock).mockReturnValue({
        isAuthenticated: false,
        user: null,
        refreshAuth: jest.fn(),
      })

      render(<RoomPage />)

      expect(screen.getByText("リダイレクト中...")).toBeInTheDocument()
      expect(mockReplace).toHaveBeenCalledWith("/?redirect=/room/ABCD1234")
    })

    it("認証済みの場合はコンポーネントが正常に表示される", async () => {
      const mockUser = {
        playerId: "player1",
        name: "テストユーザー",
      }

      ;(useAuth as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        user: mockUser,
        refreshAuth: jest.fn(),
      })

      // fetch のレスポンスをモック
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            gameId: "game1",
            players: [],
            currentRound: 1,
            currentOya: 0,
            honba: 0,
            kyotaku: 0,
            gamePhase: "waiting",
            hostPlayer: { id: "player1", name: "ホスト" },
            settings: {
              gameType: "HANCHAN",
              initialPoints: 25000,
              uma: [15, 5, -5, -15],
            },
            status: "WAITING",
          },
        }),
      })

      render(<RoomPage />)

      // ローディング状態のテスト
      expect(screen.getByText("読み込み中...")).toBeInTheDocument()

      // API 呼び出し後の表示をテスト
      await waitFor(() => {
        expect(screen.getByText("ルーム: ABCD1234")).toBeInTheDocument()
      })
    })
  })

  describe("ローディング状態", () => {
    it("ローディング中に適切なローディングメッセージを表示する", () => {
      ;(useAuth as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        user: { playerId: "player1", name: "テスト" },
        refreshAuth: jest.fn(),
      })

      // fetch を未解決のPromiseでモック
      ;(global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}))

      render(<RoomPage />)

      expect(screen.getByText("読み込み中...")).toBeInTheDocument()
    })
  })

  describe("エラー状態", () => {
    it("API エラー時にエラーメッセージとホームボタンを表示する", async () => {
      ;(useAuth as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        user: { playerId: "player1", name: "テスト" },
        refreshAuth: jest.fn(),
      })

      // fetch のエラーレスポンスをモック
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { message: "ルームが見つかりません" },
        }),
      })

      render(<RoomPage />)

      await waitFor(() => {
        expect(screen.getByText("ルームが見つかりません")).toBeInTheDocument()
      })

      const homeButton = screen.getByText("ホームに戻る")
      expect(homeButton).toBeInTheDocument()

      fireEvent.click(homeButton)
      expect(mockPush).toHaveBeenCalledWith("/")
    })

    it("ネットワークエラー時に適切なエラーメッセージを表示する", async () => {
      ;(useAuth as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        user: { playerId: "player1", name: "テスト" },
        refreshAuth: jest.fn(),
      })

      // fetch のネットワークエラーをモック
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error("ネットワークエラー")
      )

      render(<RoomPage />)

      await waitFor(() => {
        expect(screen.getByText("ネットワークエラー")).toBeInTheDocument()
      })
    })
  })

  describe("ルーム情報の表示", () => {
    const mockRoomInfo = {
      gameId: "game1",
      players: [
        {
          playerId: "player1",
          name: "プレイヤー1",
          position: 0,
          points: 25000,
          isReach: false,
          isConnected: true,
        },
        {
          playerId: "player2",
          name: "プレイヤー2",
          position: 1,
          points: 25000,
          isReach: true,
          isConnected: false,
        },
      ],
      currentRound: 1,
      currentOya: 0,
      honba: 0,
      kyotaku: 0,
      gamePhase: "waiting" as const,
      hostPlayer: { id: "player1", name: "ホスト" },
      settings: {
        gameType: "HANCHAN" as const,
        initialPoints: 25000,
        uma: [15, 5, -5, -15],
      },
      status: "WAITING" as const,
    }

    beforeEach(() => {
      ;(useAuth as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        user: { playerId: "player1", name: "テストユーザー" },
        refreshAuth: jest.fn(),
      })
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockRoomInfo,
        }),
      })
    })

    it("ルーム情報を正しく表示する", async () => {
      render(<RoomPage />)

      await waitFor(() => {
        expect(screen.getByText("ルーム: ABCD1234")).toBeInTheDocument()
        expect(screen.getByText("ホスト: ホスト")).toBeInTheDocument()
        expect(screen.getByText("✓ 接続中")).toBeInTheDocument()
        expect(screen.getByText("2/4 プレイヤー")).toBeInTheDocument()
      })
    })

    it("プレイヤー一覧を正しく表示する", async () => {
      render(<RoomPage />)

      await waitFor(() => {
        expect(screen.getByText("プレイヤー1")).toBeInTheDocument()
        expect(screen.getByText("プレイヤー2")).toBeInTheDocument()
        // 複数の25,000点があるので、少なくとも1つ以上あることを確認（プレイヤー分 + 設定分）
        expect(screen.getAllByText("25,000点")).toHaveLength(3)
        expect(screen.getByText("リーチ")).toBeInTheDocument()
      })
    })

    it("ゲーム設定を正しく表示する", async () => {
      render(<RoomPage />)

      await waitFor(() => {
        expect(screen.getByText("半荘戦")).toBeInTheDocument()
        // ゲーム設定セクション内の初期点数を確認（プレイヤー一覧とは区別）
        const gameSettingsSection = screen
          .getByText("ゲーム設定")
          .closest("div")
        expect(gameSettingsSection).toHaveTextContent("25,000点")
        // ウマは配列のjoinで表示されるため、部分マッチで検索
        expect(screen.getByText("15, 5, -5, -15")).toBeInTheDocument()
      })
    })

    it("デスクトップでQRコードを表示する", async () => {
      ;(useMediaQuery as jest.Mock).mockReturnValue(true) // デスクトップ

      render(<RoomPage />)

      await waitFor(() => {
        const qrCode = screen.getByTestId("qr-code-svg")
        expect(qrCode).toBeInTheDocument()
        // JSDOM環境では window.location.origin は "http://localhost" になる
        expect(qrCode).toHaveAttribute(
          "data-value",
          "http://localhost/room/ABCD1234"
        )
      })
    })

    it("モバイルでQRコードボタンを表示する", async () => {
      ;(useMediaQuery as jest.Mock).mockReturnValue(false) // モバイル

      render(<RoomPage />)

      await waitFor(() => {
        const qrButton = screen.getByLabelText("Show QR")
        expect(qrButton).toBeInTheDocument()

        fireEvent.click(qrButton)
        const modal = screen.getByTestId("qr-code-modal")
        expect(modal).toBeInTheDocument()
        expect(modal).toHaveTextContent(
          "QR Code Data: http://localhost/room/ABCD1234"
        )
      })
    })
  })

  describe("ルーム参加・再参加機能", () => {
    it("未参加ユーザーにルーム参加ボタンを表示する", async () => {
      const mockUser = { playerId: "player3", name: "新規ユーザー" }
      const mockRefreshAuth = jest.fn()

      ;(useAuth as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        user: mockUser,
        refreshAuth: mockRefreshAuth,
      })

      const mockRoomInfo = {
        gameId: "game1",
        players: [
          {
            playerId: "player1",
            name: "プレイヤー1",
            position: 0,
            points: 25000,
            isReach: false,
            isConnected: true,
          },
          {
            playerId: "player2",
            name: "プレイヤー2",
            position: 1,
            points: 25000,
            isReach: false,
            isConnected: true,
          },
        ],
        hostPlayer: { id: "player1", name: "ホスト" },
        settings: { gameType: "HANCHAN" },
        status: "WAITING",
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockRoomInfo }),
      })

      render(<RoomPage />)

      await waitFor(() => {
        expect(
          screen.getByText("このルームに参加しますか？")
        ).toBeInTheDocument()
        expect(
          screen.getByText("現在 2/4 人が参加しています。")
        ).toBeInTheDocument()
        expect(screen.getByText("ルームに参加")).toBeInTheDocument()
      })
    })

    it("ルーム参加ボタンをクリックして参加処理を実行する", async () => {
      const mockUser = { playerId: "player3", name: "新規ユーザー" }
      const mockRefreshAuth = jest.fn()

      ;(useAuth as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        user: mockUser,
        refreshAuth: mockRefreshAuth,
      })

      // 初回ルーム情報取得
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              gameId: "game1",
              players: [
                {
                  playerId: "player1",
                  name: "プレイヤー1",
                  points: 25000,
                  isReach: false,
                  isConnected: true,
                },
              ],
              hostPlayer: { id: "player1", name: "ホスト" },
              status: "WAITING",
            },
          }),
        })
        // ルーム参加API
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        })
        // 参加後のルーム情報取得
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              gameId: "game1",
              players: [
                {
                  playerId: "player1",
                  name: "プレイヤー1",
                  points: 25000,
                  isReach: false,
                  isConnected: true,
                },
                {
                  playerId: "player3",
                  name: "新規ユーザー",
                  points: 25000,
                  isReach: false,
                  isConnected: true,
                },
              ],
              hostPlayer: { id: "player1", name: "ホスト" },
              status: "WAITING",
            },
          }),
        })

      render(<RoomPage />)

      await waitFor(() => {
        const joinButton = screen.getByText("ルームに参加")
        fireEvent.click(joinButton)
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/room/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: "ABCD1234",
            playerName: "新規ユーザー",
          }),
          credentials: "include",
        })
        expect(mockRefreshAuth).toHaveBeenCalled()
      })
    })

    it("同名ユーザーに再参加ボタンを表示する", async () => {
      const mockUser = { playerId: "player3", name: "プレイヤー1" }

      ;(useAuth as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        user: mockUser,
        refreshAuth: jest.fn(),
      })

      const mockRoomInfo = {
        gameId: "game1",
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
        hostPlayer: { id: "player1", name: "ホスト" },
        status: "WAITING",
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockRoomInfo }),
      })

      render(<RoomPage />)

      await waitFor(() => {
        expect(
          screen.getByText("同じ名前でプレイヤーが参加しています")
        ).toBeInTheDocument()
        expect(screen.getByText("ルームに再参加")).toBeInTheDocument()
      })
    })

    it("満員時に参加できない旨を表示する", async () => {
      const mockUser = { playerId: "player5", name: "新規ユーザー" }

      ;(useAuth as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        user: mockUser,
        refreshAuth: jest.fn(),
      })

      const mockRoomInfo = {
        gameId: "game1",
        players: [
          {
            playerId: "player1",
            name: "プレイヤー1",
            points: 25000,
            isReach: false,
            isConnected: true,
          },
          {
            playerId: "player2",
            name: "プレイヤー2",
            points: 25000,
            isReach: false,
            isConnected: true,
          },
          {
            playerId: "player3",
            name: "プレイヤー3",
            points: 25000,
            isReach: false,
            isConnected: true,
          },
          {
            playerId: "player4",
            name: "プレイヤー4",
            points: 25000,
            isReach: false,
            isConnected: true,
          },
        ],
        hostPlayer: { id: "player1", name: "ホスト" },
        status: "WAITING",
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockRoomInfo }),
      })

      render(<RoomPage />)

      await waitFor(() => {
        expect(screen.getByText("ルームが満員です")).toBeInTheDocument()
        expect(
          screen.getByText("このルームは既に4人揃っているため参加できません。")
        ).toBeInTheDocument()
      })
    })
  })

  describe("ゲーム開始機能", () => {
    it("ホストかつ4人揃った場合にゲーム開始ボタンを表示する", async () => {
      const mockUser = { playerId: "player1", name: "ホスト" }

      ;(useAuth as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        user: mockUser,
        refreshAuth: jest.fn(),
      })

      const mockRoomInfo = {
        gameId: "game1",
        players: [
          {
            playerId: "player1",
            name: "プレイヤー1",
            points: 25000,
            isReach: false,
            isConnected: true,
          },
          {
            playerId: "player2",
            name: "プレイヤー2",
            points: 25000,
            isReach: false,
            isConnected: true,
          },
          {
            playerId: "player3",
            name: "プレイヤー3",
            points: 25000,
            isReach: false,
            isConnected: true,
          },
          {
            playerId: "player4",
            name: "プレイヤー4",
            points: 25000,
            isReach: false,
            isConnected: true,
          },
        ],
        hostPlayer: { id: "player1", name: "ホスト" },
        status: "WAITING",
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockRoomInfo }),
      })

      render(<RoomPage />)

      await waitFor(() => {
        expect(screen.getByText("ゲーム開始")).toBeInTheDocument()
      })
    })

    it("ゲーム開始ボタンをクリックしてゲーム画面に遷移する", async () => {
      const mockUser = { playerId: "player1", name: "ホスト" }

      ;(useAuth as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        user: mockUser,
        refreshAuth: jest.fn(),
      })

      const mockRoomInfo = {
        gameId: "game1",
        players: new Array(4).fill(null).map((_, i) => ({
          playerId: `player${i + 1}`,
          name: `プレイヤー${i + 1}`,
          points: 25000,
          isReach: false,
          isConnected: true,
        })),
        hostPlayer: { id: "player1", name: "ホスト" },
        status: "WAITING",
      }

      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: mockRoomInfo }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: { gameId: "game1" },
          }),
        })

      render(<RoomPage />)

      await waitFor(() => {
        const startButton = screen.getByText("ゲーム開始")
        fireEvent.click(startButton)
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/game/game1/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hostPlayerId: "player1" }),
          credentials: "include",
        })
        expect(mockPush).toHaveBeenCalledWith("/game/game1")
      })
    })

    it("非ホストユーザーにはゲーム開始ボタンを表示しない", async () => {
      const mockUser = { playerId: "player2", name: "プレイヤー2" }

      ;(useAuth as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        user: mockUser,
        refreshAuth: jest.fn(),
      })

      const mockRoomInfo = {
        gameId: "game1",
        players: new Array(4).fill(null).map((_, i) => ({
          playerId: `player${i + 1}`,
          name: `プレイヤー${i + 1}`,
          points: 25000,
          isReach: false,
          isConnected: true,
        })),
        hostPlayer: { id: "player1", name: "ホスト" },
        status: "WAITING",
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockRoomInfo }),
      })

      render(<RoomPage />)

      await waitFor(() => {
        expect(screen.queryByText("ゲーム開始")).not.toBeInTheDocument()
      })
    })

    it("4人未満の場合は待機メッセージを表示する", async () => {
      const mockUser = { playerId: "player1", name: "ホスト" }

      ;(useAuth as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        user: mockUser,
        refreshAuth: jest.fn(),
      })

      const mockRoomInfo = {
        gameId: "game1",
        players: [
          {
            playerId: "player1",
            name: "プレイヤー1",
            points: 25000,
            isReach: false,
            isConnected: true,
          },
          {
            playerId: "player2",
            name: "プレイヤー2",
            points: 25000,
            isReach: false,
            isConnected: true,
          },
        ],
        hostPlayer: { id: "player1", name: "ホスト" },
        status: "WAITING",
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockRoomInfo }),
      })

      render(<RoomPage />)

      await waitFor(() => {
        expect(
          screen.getByText("4人揃うまでお待ちください (2/4)")
        ).toBeInTheDocument()
      })
    })
  })

  describe("WebSocket接続とイベント処理", () => {
    it("参加者の場合WebSocketに接続する", async () => {
      const mockUser = { playerId: "player1", name: "プレイヤー1" }
      const mockSocket = {
        id: "socket-id",
        on: jest.fn(),
        off: jest.fn(),
      }

      ;(useAuth as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        user: mockUser,
        refreshAuth: jest.fn(),
      })
      ;(useSocket as jest.Mock).mockReturnValue({
        socket: mockSocket,
        isConnected: true,
        joinRoom: mockJoinRoom,
        gameState: null,
      })

      const mockRoomInfo = {
        gameId: "game1",
        players: [
          {
            playerId: "player1",
            name: "プレイヤー1",
            points: 25000,
            isReach: false,
            isConnected: true,
          },
        ],
        hostPlayer: { id: "player1", name: "ホスト" },
        status: "WAITING",
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockRoomInfo }),
      })

      render(<RoomPage />)

      await waitFor(() => {
        expect(mockJoinRoom).toHaveBeenCalledWith("ABCD1234", "player1")
        expect(mockSocket.on).toHaveBeenCalledWith(
          "game_state",
          expect.any(Function)
        )
        expect(mockSocket.on).toHaveBeenCalledWith(
          "player_joined",
          expect.any(Function)
        )
        expect(mockSocket.on).toHaveBeenCalledWith(
          "game_started",
          expect.any(Function)
        )
        expect(mockSocket.on).toHaveBeenCalledWith(
          "error",
          expect.any(Function)
        )
      })
    })

    it("非参加者の場合WebSocketに接続しない", async () => {
      const mockUser = { playerId: "player5", name: "観戦者" }

      ;(useAuth as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        user: mockUser,
        refreshAuth: jest.fn(),
      })

      const mockRoomInfo = {
        gameId: "game1",
        players: [
          {
            playerId: "player1",
            name: "プレイヤー1",
            points: 25000,
            isReach: false,
            isConnected: true,
          },
        ],
        hostPlayer: { id: "player1", name: "ホスト" },
        status: "WAITING",
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockRoomInfo }),
      })

      render(<RoomPage />)

      await waitFor(() => {
        expect(mockJoinRoom).not.toHaveBeenCalled()
      })
    })
  })

  describe("席順変更機能（ホスト専用）", () => {
    it("ホストかつ4人揃った場合に席順変更用のReorderコンポーネントを表示する", async () => {
      const mockUser = { playerId: "player1", name: "ホスト" }

      ;(useAuth as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        user: mockUser,
        refreshAuth: jest.fn(),
      })

      const mockGameState = {
        gameId: "game1",
        players: [
          {
            playerId: "player1",
            name: "プレイヤー1",
            position: 0,
            points: 25000,
            isReach: false,
            isConnected: true,
          },
          {
            playerId: "player2",
            name: "プレイヤー2",
            position: 1,
            points: 25000,
            isReach: false,
            isConnected: true,
          },
          {
            playerId: "player3",
            name: "プレイヤー3",
            position: 2,
            points: 25000,
            isReach: false,
            isConnected: true,
          },
          {
            playerId: "player4",
            name: "プレイヤー4",
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
        gamePhase: "waiting" as const,
      }

      ;(useSocket as jest.Mock).mockReturnValue({
        socket: { id: "socket-id", on: jest.fn(), off: jest.fn() },
        isConnected: true,
        joinRoom: mockJoinRoom,
        gameState: mockGameState,
      })

      const mockRoomInfo = {
        ...mockGameState,
        hostPlayer: { id: "player1", name: "ホスト" },
        settings: { gameType: "HANCHAN" },
        status: "WAITING",
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockRoomInfo }),
      })

      render(<RoomPage />)

      await waitFor(() => {
        expect(screen.getByTestId("reorder-group")).toBeInTheDocument()
        expect(screen.getAllByTestId("reorder-item")).toHaveLength(4)
      })
    })

    it("非ホストの場合は通常のプレイヤー一覧を表示する", async () => {
      const mockUser = { playerId: "player2", name: "プレイヤー2" }

      ;(useAuth as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        user: mockUser,
        refreshAuth: jest.fn(),
      })

      const mockGameState = {
        gameId: "game1",
        players: [
          {
            playerId: "player1",
            name: "プレイヤー1",
            position: 0,
            points: 25000,
            isReach: false,
            isConnected: true,
          },
          {
            playerId: "player2",
            name: "プレイヤー2",
            position: 1,
            points: 25000,
            isReach: false,
            isConnected: true,
          },
        ],
        currentRound: 1,
        currentOya: 0,
        honba: 0,
        kyotaku: 0,
        gamePhase: "waiting" as const,
      }

      ;(useSocket as jest.Mock).mockReturnValue({
        socket: { id: "socket-id", on: jest.fn(), off: jest.fn() },
        isConnected: true,
        joinRoom: mockJoinRoom,
        gameState: mockGameState,
      })

      const mockRoomInfo = {
        ...mockGameState,
        hostPlayer: { id: "player1", name: "ホスト" },
        settings: { gameType: "HANCHAN" },
        status: "WAITING",
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockRoomInfo }),
      })

      render(<RoomPage />)

      await waitFor(() => {
        expect(screen.queryByTestId("reorder-group")).not.toBeInTheDocument()
        expect(screen.getByText("プレイヤー1")).toBeInTheDocument()
        expect(screen.getByText("プレイヤー2")).toBeInTheDocument()
        // 複数の"待機中..."があるので、少なくとも1つ以上あることを確認
        expect(screen.getAllByText("待機中...")).toHaveLength(2)
      })
    })
  })

  describe("ホーム戻るボタン", () => {
    it("ホームに戻るボタンをクリックしてルートに遷移する", async () => {
      ;(useAuth as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        user: { playerId: "player1", name: "テスト" },
        refreshAuth: jest.fn(),
      })
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            gameId: "game1",
            players: [],
            hostPlayer: { id: "player1", name: "ホスト" },
            settings: { gameType: "HANCHAN" },
            status: "WAITING",
          },
        }),
      })

      render(<RoomPage />)

      await waitFor(() => {
        const homeButton = screen.getByText("ホームに戻る")
        fireEvent.click(homeButton)
        expect(mockPush).toHaveBeenCalledWith("/")
      })
    })
  })
})
