import { POST } from "../route"
import { requireAuth } from "@/lib/auth"
import { PointManager } from "@/lib/point-manager"
import { analyzeVotes } from "@/lib/vote-analysis"
import { getIO } from "@/lib/vote-globals"
import { NextRequest } from "next/server"

// モック設定
jest.mock("@/lib/auth")
jest.mock("@/lib/point-manager")
jest.mock("@/lib/vote-analysis")
jest.mock("@/lib/vote-globals")

const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>
const mockAnalyzeVotes = analyzeVotes as jest.MockedFunction<
  typeof analyzeVotes
>
const mockGetIO = getIO as jest.MockedFunction<typeof getIO>

// PointManagerのモック
const mockPointManager = {
  getGameInfo: jest.fn(),
}

// Socket.IOのモック
const mockIO = {
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
}

describe("POST /api/game/[gameId]/cancel-vote-session", () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // グローバル変数の初期化
    global.gameVotes = {}
    global.voteStartTimes = {}

    // デフォルトのモック設定
    mockRequireAuth.mockResolvedValue({
      playerId: "player1",
      name: "テストプレイヤー",
    } as any)
    ;(PointManager as jest.Mock).mockImplementation(() => mockPointManager)

    mockPointManager.getGameInfo.mockResolvedValue({
      roomCode: "TEST123",
    })

    mockAnalyzeVotes.mockReturnValue({
      allVoted: false,
      allAgreed: false,
      votes: {},
    })

    mockGetIO.mockReturnValue(mockIO as any)
  })

  describe("正常系", () => {
    it("投票を正常にキャンセルできる", async () => {
      // グローバル変数に投票データを設定
      global.gameVotes = {
        game1: {
          player1: true,
          player2: false,
        },
      }
      global.voteStartTimes = {
        game1: Date.now(),
      }

      const request = new NextRequest(
        "http://localhost/api/game/game1/cancel-vote-session",
        {
          method: "POST",
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ gameId: "game1" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.message).toBe("投票を取り消しました")
      expect(data.data.playerName).toBe("テストプレイヤー")

      // 投票が削除されることを確認
      expect(global.gameVotes["game1"]["player1"]).toBeUndefined()
      expect(global.gameVotes["game1"]["player2"]).toBe(false)
    })

    it("最後の投票をキャンセルした場合、投票データが完全にクリアされる", async () => {
      global.gameVotes = {
        game1: {
          player1: true,
        },
      }
      global.voteStartTimes = {
        game1: Date.now(),
      }

      const request = new NextRequest(
        "http://localhost/api/game/game1/cancel-vote-session",
        {
          method: "POST",
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ gameId: "game1" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // 投票データが完全にクリアされることを確認
      expect(global.gameVotes["game1"]).toBeUndefined()
      expect(global.voteStartTimes["game1"]).toBeUndefined()
    })

    it("WebSocket通知が正常に送信される", async () => {
      global.gameVotes = {
        game1: {
          player1: true,
          player2: false,
        },
      }

      const request = new NextRequest(
        "http://localhost/api/game/game1/cancel-vote-session",
        {
          method: "POST",
        }
      )

      await POST(request, { params: Promise.resolve({ gameId: "game1" }) })

      expect(mockPointManager.getGameInfo).toHaveBeenCalled()
      expect(mockGetIO).toHaveBeenCalled()
      expect(mockAnalyzeVotes).toHaveBeenCalledWith({ player2: false }, 4)
      expect(mockIO.to).toHaveBeenCalledWith("TEST123")
      expect(mockIO.emit).toHaveBeenCalledWith("session_vote_update", {
        votes: { player2: false },
        result: expect.any(Object),
        voterName: "テストプレイヤー",
      })
    })

    it("投票データが存在しない場合も正常に処理される", async () => {
      global.gameVotes = {}
      global.voteStartTimes = {}

      const request = new NextRequest(
        "http://localhost/api/game/game1/cancel-vote-session",
        {
          method: "POST",
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ gameId: "game1" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.currentVotes).toEqual({})
    })

    it("該当プレイヤーの投票が存在しない場合も正常に処理される", async () => {
      global.gameVotes = {
        game1: {
          player2: true,
        },
      }

      const request = new NextRequest(
        "http://localhost/api/game/game1/cancel-vote-session",
        {
          method: "POST",
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ gameId: "game1" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      // 他の投票は残る
      expect(data.data.currentVotes).toEqual({ player2: true })
    })
  })

  describe("WebSocket関連", () => {
    it("WebSocketインスタンスが見つからない場合でも処理が継続される", async () => {
      global.gameVotes = {
        game1: {
          player1: true,
        },
      }

      mockGetIO.mockReturnValue(null)

      const request = new NextRequest(
        "http://localhost/api/game/game1/cancel-vote-session",
        {
          method: "POST",
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ gameId: "game1" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      // WebSocket通知は送信されないが、処理は正常に完了
    })

    it("ゲーム情報の取得に失敗してもWebSocket通知なしで処理が継続される", async () => {
      global.gameVotes = {
        game1: {
          player1: true,
        },
      }

      mockPointManager.getGameInfo.mockResolvedValue(null)

      const request = new NextRequest(
        "http://localhost/api/game/game1/cancel-vote-session",
        {
          method: "POST",
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ gameId: "game1" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      // WebSocket通知は送信されない
      expect(mockIO.emit).not.toHaveBeenCalled()
    })

    it("roomCodeが存在しない場合はWebSocket通知が送信されない", async () => {
      global.gameVotes = {
        game1: {
          player1: true,
        },
      }

      mockPointManager.getGameInfo.mockResolvedValue({
        roomCode: null,
      })

      const request = new NextRequest(
        "http://localhost/api/game/game1/cancel-vote-session",
        {
          method: "POST",
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ gameId: "game1" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(mockIO.emit).not.toHaveBeenCalled()
    })
  })

  describe("エラーハンドリング", () => {
    it("認証エラーが正しく処理される", async () => {
      mockRequireAuth.mockRejectedValue(new Error("Authentication required"))

      const request = new NextRequest(
        "http://localhost/api/game/game1/cancel-vote-session",
        {
          method: "POST",
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ gameId: "game1" }),
      })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.message).toBe("認証が必要です")
    })

    it("PointManager エラーが正しく処理される", async () => {
      mockPointManager.getGameInfo.mockRejectedValue(
        new Error("Database error")
      )

      const request = new NextRequest(
        "http://localhost/api/game/game1/cancel-vote-session",
        {
          method: "POST",
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ gameId: "game1" }),
      })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.message).toBe("投票の取り消しに失敗しました")
      expect(data.error.details).toBe("Database error")
    })

    it("不明なエラーが正しく処理される", async () => {
      mockRequireAuth.mockRejectedValue("Unknown error")

      const request = new NextRequest(
        "http://localhost/api/game/game1/cancel-vote-session",
        {
          method: "POST",
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ gameId: "game1" }),
      })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.message).toBe("投票の取り消しに失敗しました")
      expect(data.error.details).toBe("Unknown error")
    })
  })

  describe("グローバル変数の操作", () => {
    it("グローバル変数が未初期化の場合でも正常に処理される", async () => {
      // グローバル変数を削除
      delete (global as any).gameVotes
      delete (global as any).voteStartTimes

      const request = new NextRequest(
        "http://localhost/api/game/game1/cancel-vote-session",
        {
          method: "POST",
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ gameId: "game1" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.currentVotes).toEqual({})
    })

    it("複数の投票セッションが存在する場合、該当セッションのみ削除される", async () => {
      global.gameVotes = {
        game1: {
          player1: true,
          player2: false,
        },
        game2: {
          player1: false,
          player3: true,
        },
      }

      const request = new NextRequest(
        "http://localhost/api/game/game1/cancel-vote-session",
        {
          method: "POST",
        }
      )

      await POST(request, { params: Promise.resolve({ gameId: "game1" }) })

      // game1のplayer1の投票のみ削除される
      expect(global.gameVotes["game1"]["player1"]).toBeUndefined()
      expect(global.gameVotes["game1"]["player2"]).toBe(false)
      // game2の投票は残る
      expect(global.gameVotes["game2"]).toEqual({
        player1: false,
        player3: true,
      })
    })
  })
})
