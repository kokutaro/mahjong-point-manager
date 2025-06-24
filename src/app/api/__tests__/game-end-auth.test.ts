import { NextRequest } from 'next/server'
import { POST } from '../game/[gameId]/end/route'

// lib/auth のモック
jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  checkHostAccess: jest.fn()
}))

// lib/point-manager のモック
const mockForceEndGame = jest.fn()
const mockGetGameState = jest.fn()
const mockGetGameInfo = jest.fn()

jest.mock('@/lib/point-manager', () => ({
  PointManager: jest.fn().mockImplementation(() => ({
    forceEndGame: mockForceEndGame,
    getGameState: mockGetGameState,
    getGameInfo: mockGetGameInfo
  }))
}))

// WebSocket のモック
const mockIO = {
  to: jest.fn().mockReturnThis(),
  emit: jest.fn()
}

// プロセスの __socketio プロパティをモック
Object.defineProperty(process, '__socketio', {
  value: mockIO,
  writable: true
})

const { requireAuth, checkHostAccess } = require('@/lib/auth')

describe('Game End API 権限チェック', () => {
  const mockGameId = 'test-game-id'
  const mockHostPlayer = {
    playerId: 'host-player-id',
    name: 'ホストプレイヤー'
  }
  const mockNonHostPlayer = {
    playerId: 'non-host-player-id', 
    name: '一般プレイヤー'
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    // デフォルトのモック設定
    mockForceEndGame.mockResolvedValue(undefined)
    mockGetGameState.mockResolvedValue({ gameId: mockGameId, status: 'FINISHED' })
    mockGetGameInfo.mockResolvedValue({ roomCode: 'TEST123' })
  })

  test('ホストプレイヤーはゲームを強制終了できる', async () => {
    // ホストとして認証されるよう設定
    ;(requireAuth as jest.Mock).mockResolvedValue(mockHostPlayer)
    ;(checkHostAccess as jest.Mock).mockResolvedValue(true)

    const request = new NextRequest('http://localhost/api/game/test-game-id/end', {
      method: 'POST',
      body: JSON.stringify({ reason: 'ホストによる強制終了' })
    })

    const params = Promise.resolve({ gameId: mockGameId })
    const response = await POST(request, { params })
    const responseData = await response.json()

    // 成功レスポンスを確認
    expect(response.status).toBe(200)
    expect(responseData.success).toBe(true)
    expect(responseData.data.message).toContain('ゲームを終了しました')

    // 認証とホスト権限チェックが呼び出されたことを確認
    expect(requireAuth).toHaveBeenCalledTimes(1)
    expect(checkHostAccess).toHaveBeenCalledWith(mockGameId, mockHostPlayer.playerId)

    // 強制終了処理が実行されたことを確認
    expect(mockForceEndGame).toHaveBeenCalledWith('ホストによる強制終了')
  })

  test('非ホストプレイヤーはゲームを強制終了できない', async () => {
    // 非ホストとして認証されるよう設定
    ;(requireAuth as jest.Mock).mockResolvedValue(mockNonHostPlayer)
    ;(checkHostAccess as jest.Mock).mockResolvedValue(false)

    const request = new NextRequest('http://localhost/api/game/test-game-id/end', {
      method: 'POST',
      body: JSON.stringify({ reason: '不正な強制終了試行' })
    })

    const params = Promise.resolve({ gameId: mockGameId })
    const response = await POST(request, { params })
    const responseData = await response.json()

    // 403 Forbidden レスポンスを確認
    expect(response.status).toBe(403)
    expect(responseData.success).toBe(false)
    expect(responseData.error.message).toBe('この操作にはホスト権限が必要です')

    // 認証とホスト権限チェックが呼び出されたことを確認
    expect(requireAuth).toHaveBeenCalledTimes(1)
    expect(checkHostAccess).toHaveBeenCalledWith(mockGameId, mockNonHostPlayer.playerId)

    // 強制終了処理が実行されていないことを確認
    expect(mockForceEndGame).not.toHaveBeenCalled()
  })

  test('認証されていないユーザーは401エラーを受け取る', async () => {
    // 認証失敗をシミュレート
    ;(requireAuth as jest.Mock).mockRejectedValue(new Error('Authentication required'))

    const request = new NextRequest('http://localhost/api/game/test-game-id/end', {
      method: 'POST',
      body: JSON.stringify({ reason: '認証なし試行' })
    })

    const params = Promise.resolve({ gameId: mockGameId })
    const response = await POST(request, { params })
    const responseData = await response.json()

    // 401 Unauthorized レスポンスを確認
    expect(response.status).toBe(401)
    expect(responseData.success).toBe(false)
    expect(responseData.error.message).toBe('認証が必要です')

    // 認証が試行されたことを確認
    expect(requireAuth).toHaveBeenCalledTimes(1)
    
    // ホスト権限チェックが実行されていないことを確認
    expect(checkHostAccess).not.toHaveBeenCalled()
    
    // 強制終了処理が実行されていないことを確認
    expect(mockForceEndGame).not.toHaveBeenCalled()
  })

  test('存在しないゲームIDでホスト権限チェックが失敗する', async () => {
    // 認証は成功するが、ホスト権限チェックが失敗
    ;(requireAuth as jest.Mock).mockResolvedValue(mockHostPlayer)
    ;(checkHostAccess as jest.Mock).mockResolvedValue(false)

    const invalidGameId = 'invalid-game-id'
    const request = new NextRequest('http://localhost/api/game/invalid-game-id/end', {
      method: 'POST',
      body: JSON.stringify({ reason: '存在しないゲーム' })
    })

    const params = Promise.resolve({ gameId: invalidGameId })
    const response = await POST(request, { params })
    const responseData = await response.json()

    // 403 Forbidden レスポンスを確認
    expect(response.status).toBe(403)
    expect(responseData.success).toBe(false)
    expect(responseData.error.message).toBe('この操作にはホスト権限が必要です')

    // 権限チェックが正しいゲームIDで呼び出されたことを確認
    expect(checkHostAccess).toHaveBeenCalledWith(invalidGameId, mockHostPlayer.playerId)
  })

  test('reasonパラメータがない場合、デフォルト値が使用される', async () => {
    ;(requireAuth as jest.Mock).mockResolvedValue(mockHostPlayer)
    ;(checkHostAccess as jest.Mock).mockResolvedValue(true)

    const request = new NextRequest('http://localhost/api/game/test-game-id/end', {
      method: 'POST',
      body: JSON.stringify({}) // reasonなし
    })

    const params = Promise.resolve({ gameId: mockGameId })
    const response = await POST(request, { params })
    const responseData = await response.json()

    expect(response.status).toBe(200)
    expect(responseData.success).toBe(true)

    // デフォルトのreason（'強制終了'）で強制終了処理が呼び出されたことを確認
    expect(mockForceEndGame).toHaveBeenCalledWith('強制終了')
  })

  test('バリデーションエラーの場合、400エラーを返す', async () => {
    ;(requireAuth as jest.Mock).mockResolvedValue(mockHostPlayer)
    ;(checkHostAccess as jest.Mock).mockResolvedValue(true)

    const request = new NextRequest('http://localhost/api/game/test-game-id/end', {
      method: 'POST',
      body: JSON.stringify({ reason: 123 }) // 文字列でない
    })

    const params = Promise.resolve({ gameId: mockGameId })
    const response = await POST(request, { params })
    const responseData = await response.json()

    expect(response.status).toBe(400)
    expect(responseData.success).toBe(false)
    expect(responseData.error.message).toBe('バリデーションエラー')
  })

  test('WebSocket通知が正しく送信される', async () => {
    ;(requireAuth as jest.Mock).mockResolvedValue(mockHostPlayer)
    ;(checkHostAccess as jest.Mock).mockResolvedValue(true)

    const request = new NextRequest('http://localhost/api/game/test-game-id/end', {
      method: 'POST',
      body: JSON.stringify({ reason: 'テスト終了' })
    })

    const params = Promise.resolve({ gameId: mockGameId })
    const response = await POST(request, { params })

    expect(response.status).toBe(200)

    // WebSocket通知が送信されたことを確認
    expect(mockIO.to).toHaveBeenCalledWith('TEST123')
    expect(mockIO.emit).toHaveBeenCalledWith('game_ended', {
      gameState: { gameId: mockGameId, status: 'FINISHED' },
      reason: 'テスト終了',
      finalResults: true,
      forced: true
    })
  })
})