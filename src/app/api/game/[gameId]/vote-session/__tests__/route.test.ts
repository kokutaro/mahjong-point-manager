import { POST, DELETE } from "../route"
import { createMocks } from "node-mocks-http"
import { NextRequest } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getIO } from "@/lib/vote-globals"
import { analyzeVotes } from "@/lib/vote-analysis"
import { createRematch } from "@/lib/rematch-service"

const mockGetGameInfo = jest.fn()
const mockForceEndGame = jest.fn()
jest.mock("@/lib/point-manager", () => ({
  PointManager: jest.fn().mockImplementation(() => ({
    getGameInfo: mockGetGameInfo,
    forceEndGame: mockForceEndGame,
  })),
}))

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn(),
}))

const mockEmit = jest.fn()
const mockTo = jest.fn(() => ({ emit: mockEmit }))
jest.mock("@/lib/vote-globals", () => ({
  getIO: jest.fn(() => ({ to: mockTo })),
  initializeVoteGlobals: jest.fn(),
}))

jest.mock("@/lib/vote-analysis", () => ({
  analyzeVotes: jest.fn(),
}))

jest.mock("@/lib/rematch-service", () => ({
  createRematch: jest.fn(),
}))

describe("POST /api/game/[gameId]/vote-session", () => {
  const mockAuth = requireAuth as jest.Mock
  const mockGetIOFunc = getIO as jest.Mock
  const mockAnalyzeVotes = analyzeVotes as jest.Mock
  const mockCreateRematch = createRematch as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    global.gameVotes = {}
    global.voteStartTimes = {}

    // デフォルトのモック設定
    mockAuth.mockResolvedValue({ playerId: "p1", name: "TestPlayer" })
    mockGetIOFunc.mockReturnValue({ to: mockTo })
    mockAnalyzeVotes.mockReturnValue({
      action: "wait",
      message: "",
      details: {
        continueVotes: 0,
        endVotes: 0,
        pauseVotes: 0,
        totalPlayers: 4,
        votedPlayers: 1,
      },
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe("バリデーション", () => {
    it("無効な投票で400エラーを返す", async () => {
      const { req } = createMocks({
        method: "POST",
        json: () => ({ vote: "invalid" }),
      })
      const res = await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: "g1" }),
      })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.error.message).toBe("バリデーションエラー")
    })

    it("voteフィールドが欠けている場合400エラーを返す", async () => {
      const { req } = createMocks({
        method: "POST",
        json: () => ({}),
      })
      const res = await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: "g1" }),
      })
      expect(res.status).toBe(400)
    })
  })

  describe("認証", () => {
    it("認証エラーで401エラーを返す", async () => {
      mockAuth.mockRejectedValue(new Error("Authentication required"))

      const { req } = createMocks({
        method: "POST",
        json: () => ({ vote: "continue" }),
      })
      const res = await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: "g1" }),
      })
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error.message).toBe("認証が必要です")
    })
  })

  describe("ゲーム存在確認", () => {
    it("ゲームが見つからない場合404エラーを返す", async () => {
      mockGetGameInfo.mockResolvedValue(null)

      const { req } = createMocks({
        method: "POST",
        json: () => ({ vote: "continue" }),
      })
      const res = await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: "g1" }),
      })
      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error.message).toBe("ゲームが見つかりません")
    })

    it("セッションが存在しない場合400エラーを返す", async () => {
      mockGetGameInfo.mockResolvedValue({ sessionId: null, roomCode: "R" })

      const { req } = createMocks({
        method: "POST",
        json: () => ({ vote: "continue" }),
      })
      const res = await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: "g1" }),
      })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.message).toBe("セッションが存在しません")
    })
  })

  describe("投票記録", () => {
    beforeEach(() => {
      mockGetGameInfo.mockResolvedValue({ sessionId: "s1", roomCode: "ROOM1" })
    })

    it("初回投票時に投票データを初期化する", async () => {
      const { req } = createMocks({
        method: "POST",
        json: () => ({ vote: "continue" }),
      })
      await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: "g1" }),
      })

      expect(global.gameVotes["g1"]).toBeDefined()
      expect(global.voteStartTimes["g1"]).toBeDefined()
      expect(global.gameVotes["g1"]["p1"]).toBe("continue")
    })

    it("有効な投票を記録する", async () => {
      const { req } = createMocks({
        method: "POST",
        json: () => ({ vote: "end" }),
      })
      const res = await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: "g1" }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.vote).toBe("end")
      expect(global.gameVotes["g1"]["p1"]).toBe("end")
    })

    it("WebSocket通知が送信される", async () => {
      const { req } = createMocks({
        method: "POST",
        json: () => ({ vote: "pause" }),
      })
      await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: "g1" }),
      })

      expect(mockTo).toHaveBeenCalledWith("ROOM1")
      expect(mockEmit).toHaveBeenCalledWith("session_vote_update", {
        votes: { p1: "pause" },
        result: expect.any(Object),
        voterName: "TestPlayer",
      })
    })
  })

  describe("全員合意による終了", () => {
    beforeEach(() => {
      mockGetGameInfo.mockResolvedValue({ sessionId: "s1", roomCode: "ROOM1" })
      mockAnalyzeVotes.mockReturnValue({
        action: "end",
        message: "All players voted to end",
        details: {
          continueVotes: 0,
          endVotes: 4,
          pauseVotes: 0,
          totalPlayers: 4,
          votedPlayers: 4,
        },
      })
    })

    it("全員が終了投票した場合、ゲームを強制終了する", async () => {
      mockForceEndGame.mockResolvedValue(undefined)

      const { req } = createMocks({
        method: "POST",
        json: () => ({ vote: "end" }),
      })
      await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: "g1" }),
      })

      expect(mockForceEndGame).toHaveBeenCalledWith("全員合意による終了")
      expect(mockEmit).toHaveBeenCalledWith("session_ended_by_consensus", {
        reason: "全員合意による終了",
        voteDetails: expect.any(Object),
      })
      expect(global.gameVotes["g1"]).toBeUndefined()
      expect(global.voteStartTimes["g1"]).toBeUndefined()
    })

    it("ゲーム終了でエラーが発生しても処理を継続する", async () => {
      mockForceEndGame.mockRejectedValue(new Error("End game failed"))

      const { req } = createMocks({
        method: "POST",
        json: () => ({ vote: "end" }),
      })
      const res = await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: "g1" }),
      })

      expect(res.status).toBe(200) // エラーでも成功レスポンス
    })
  })

  describe("継続プロセス", () => {
    beforeEach(() => {
      mockGetGameInfo.mockResolvedValue({ sessionId: "s1", roomCode: "ROOM1" })
      mockAnalyzeVotes.mockReturnValue({
        action: "continue",
        message: "All players voted to continue",
        details: {
          continueVotes: 4,
          endVotes: 0,
          pauseVotes: 0,
          totalPlayers: 4,
          votedPlayers: 4,
        },
      })
    })

    it("全員が継続投票した場合、再戦処理を実行する", async () => {
      mockCreateRematch.mockResolvedValue({
        success: true,
        data: {
          roomCode: "NEWROOM",
          gameId: "newGame",
          sessionId: "newSession",
        },
      })

      const { req } = createMocks({
        method: "POST",
        json: () => ({ vote: "continue" }),
      })
      await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: "g1" }),
      })

      expect(mockCreateRematch).toHaveBeenCalledWith("g1", {
        continueSession: true,
      })
      expect(mockEmit).toHaveBeenCalledWith("session_continue_agreed", {
        continueVotes: 4,
      })
      expect(mockEmit).toHaveBeenCalledWith("new-room-ready", {
        roomCode: "NEWROOM",
        gameId: "newGame",
        sessionId: "newSession",
      })
    })

    it("再戦処理が失敗した場合、失敗通知を送信する", async () => {
      mockCreateRematch.mockResolvedValue({
        success: false,
        error: {
          message: "Rematch failed",
          details: "Database error",
        },
      })

      const { req } = createMocks({
        method: "POST",
        json: () => ({ vote: "continue" }),
      })
      await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: "g1" }),
      })

      expect(mockEmit).toHaveBeenCalledWith("session_continue_failed", {
        message: "Rematch failed",
        details: "Database error",
      })
    })

    it("再戦処理でAbortErrorが発生した場合、タイムアウトメッセージを送信する", async () => {
      const abortError = new Error("Request timeout")
      abortError.name = "AbortError"
      mockCreateRematch.mockRejectedValue(abortError)

      const { req } = createMocks({
        method: "POST",
        json: () => ({ vote: "continue" }),
      })
      await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: "g1" }),
      })

      expect(mockEmit).toHaveBeenCalledWith("session_continue_failed", {
        message: "新しいルーム作成がタイムアウトしました",
        details: "10秒以内に処理が完了しませんでした",
      })
    })

    it("再戦処理で一般的なエラーが発生した場合、エラーメッセージを送信する", async () => {
      mockCreateRematch.mockRejectedValue(new Error("Generic error"))

      const { req } = createMocks({
        method: "POST",
        json: () => ({ vote: "continue" }),
      })
      await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: "g1" }),
      })

      expect(mockEmit).toHaveBeenCalledWith("session_continue_failed", {
        message: "新しいルーム作成に失敗しました",
        details: "Generic error",
      })
    })
  })

  describe("保留による投票リセット", () => {
    beforeEach(() => {
      mockGetGameInfo.mockResolvedValue({ sessionId: "s1", roomCode: "ROOM1" })
      mockAnalyzeVotes.mockReturnValue({
        action: "wait",
        message: "All players voted to pause",
        details: {
          continueVotes: 0,
          endVotes: 0,
          pauseVotes: 4,
          totalPlayers: 4,
          votedPlayers: 4,
        },
      })
    })

    it("全員が保留投票した場合、3秒後に投票をリセットする", async () => {
      const { req } = createMocks({
        method: "POST",
        json: () => ({ vote: "pause" }),
      })
      await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: "g1" }),
      })

      // 初期状態では投票が存在する
      expect(global.gameVotes["g1"]).toBeDefined()

      // 3秒経過をシミュレート
      jest.advanceTimersByTime(3000)

      expect(global.gameVotes["g1"]).toBeUndefined()
      expect(global.voteStartTimes["g1"]).toBeUndefined()
      expect(mockEmit).toHaveBeenCalledWith("vote_timeout", {
        reason: "全員が保留を選択したため投票をリセットしました",
      })
    })
  })

  describe("WebSocketなしの環境", () => {
    it("WebSocketが利用できない場合でも正常に処理される", async () => {
      mockGetIOFunc.mockReturnValue(null)
      mockGetGameInfo.mockResolvedValue({ sessionId: "s1", roomCode: "ROOM1" })

      const { req } = createMocks({
        method: "POST",
        json: () => ({ vote: "continue" }),
      })
      const res = await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: "g1" }),
      })

      expect(res.status).toBe(200)
      expect(mockEmit).not.toHaveBeenCalled()
    })
  })

  describe("一般的なエラー", () => {
    it("データベースエラーで500エラーを返す", async () => {
      mockGetGameInfo.mockRejectedValue(new Error("Database error"))

      const { req } = createMocks({
        method: "POST",
        json: () => ({ vote: "continue" }),
      })
      const res = await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: "g1" }),
      })

      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error.message).toBe("投票処理に失敗しました")
      expect(body.error.details).toBe("Database error")
    })

    it("不明なエラーで500エラーを返す", async () => {
      mockGetGameInfo.mockRejectedValue("Unknown error")

      const { req } = createMocks({
        method: "POST",
        json: () => ({ vote: "continue" }),
      })
      const res = await POST(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: "g1" }),
      })

      expect(res.status).toBe(500)
      expect((await res.json()).error.details).toBe("Unknown error")
    })
  })
})

describe("DELETE /api/game/[gameId]/vote-session", () => {
  const mockAuth = requireAuth as jest.Mock
  const mockGetIOFunc = getIO as jest.Mock
  const mockAnalyzeVotes = analyzeVotes as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    global.gameVotes = {}
    global.voteStartTimes = {}

    mockAuth.mockResolvedValue({ playerId: "p1", name: "TestPlayer" })
    mockGetIOFunc.mockReturnValue({ to: mockTo })
    mockAnalyzeVotes.mockReturnValue({
      action: "wait",
      message: "",
      details: {
        continueVotes: 0,
        endVotes: 0,
        pauseVotes: 0,
        totalPlayers: 4,
        votedPlayers: 0,
      },
    })
  })

  describe("投票取り消し", () => {
    it("正常に投票を取り消せる", async () => {
      // 事前に投票を設定
      global.gameVotes = { g1: { p1: "continue", p2: "end" } }
      global.voteStartTimes = { g1: "2023-01-01T00:00:00.000Z" }
      mockGetGameInfo.mockResolvedValue({ sessionId: "s1", roomCode: "ROOM1" })

      const { req } = createMocks({ method: "DELETE" })
      const res = await DELETE(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: "g1" }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.message).toBe("投票を取り消しました")
      expect(global.gameVotes["g1"]["p1"]).toBeUndefined()
      expect(global.gameVotes["g1"]["p2"]).toBe("end") // 他の投票は残る
    })

    it("投票が存在しない場合でも正常に処理される", async () => {
      mockGetGameInfo.mockResolvedValue({ sessionId: "s1", roomCode: "ROOM1" })

      const { req } = createMocks({ method: "DELETE" })
      const res = await DELETE(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: "g1" }),
      })

      expect(res.status).toBe(200)
    })

    it("最後の投票者が取り消した場合、投票データ全体をリセットする", async () => {
      global.gameVotes = { g1: { p1: "continue" } }
      global.voteStartTimes = { g1: "2023-01-01T00:00:00.000Z" }
      mockGetGameInfo.mockResolvedValue({ sessionId: "s1", roomCode: "ROOM1" })

      const { req } = createMocks({ method: "DELETE" })
      await DELETE(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: "g1" }),
      })

      expect(global.gameVotes["g1"]).toBeUndefined()
      expect(global.voteStartTimes["g1"]).toBeUndefined()
    })

    it("WebSocket通知が送信される", async () => {
      global.gameVotes = { g1: { p1: "continue" } }
      mockGetGameInfo.mockResolvedValue({ sessionId: "s1", roomCode: "ROOM1" })

      const { req } = createMocks({ method: "DELETE" })
      await DELETE(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: "g1" }),
      })

      expect(mockTo).toHaveBeenCalledWith("ROOM1")
      expect(mockEmit).toHaveBeenCalledWith("session_vote_update", {
        votes: {},
        result: expect.any(Object),
        voterName: "TestPlayer",
      })
    })

    it("WebSocketが利用できない場合でも正常に処理される", async () => {
      mockGetIOFunc.mockReturnValue(null)
      global.gameVotes = { g1: { p1: "continue" } }
      mockGetGameInfo.mockResolvedValue({ sessionId: "s1", roomCode: "ROOM1" })

      const { req } = createMocks({ method: "DELETE" })
      const res = await DELETE(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: "g1" }),
      })

      expect(res.status).toBe(200)
    })

    it("ゲーム情報取得でエラーが発生しても投票取り消しは成功する", async () => {
      global.gameVotes = { g1: { p1: "continue" } }
      mockGetGameInfo.mockResolvedValue(null)

      const { req } = createMocks({ method: "DELETE" })
      const res = await DELETE(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: "g1" }),
      })

      expect(res.status).toBe(200)
      expect(global.gameVotes["g1"]).toBeUndefined()
    })
  })

  describe("エラーハンドリング", () => {
    it("認証エラーで500エラーを返す", async () => {
      mockAuth.mockRejectedValue(new Error("Auth failed"))

      const { req } = createMocks({ method: "DELETE" })
      const res = await DELETE(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: "g1" }),
      })

      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error.message).toBe("投票の取り消しに失敗しました")
    })

    it("一般的なエラーで500エラーを返す", async () => {
      mockGetGameInfo.mockRejectedValue(new Error("Database error"))

      const { req } = createMocks({ method: "DELETE" })
      const res = await DELETE(req as unknown as NextRequest, {
        params: Promise.resolve({ gameId: "g1" }),
      })

      expect(res.status).toBe(500)
    })
  })
})
