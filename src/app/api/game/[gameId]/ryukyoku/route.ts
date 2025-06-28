import { NextRequest } from 'next/server'
import { z } from 'zod'
import { PointManager } from '@/lib/point-manager'
import { SoloPointManager } from '@/lib/solo/solo-point-manager'
import { PlayerIdentifierSchema } from '@/schemas/common'
import { prisma } from '@/lib/prisma'
import { 
  withErrorHandler, 
  createSuccessResponse, 
  validateSchema,
  validatePlayerPosition,
  AppError
} from '@/lib/error-handler'
import type { SoloGame, SoloPlayer } from '@prisma/client'

// WebSocket 型定義
interface SocketIOInstance {
  to(room: string): {
    emit(event: string, data: unknown): void
  }
}

// 流局データ型

type MultiplayerRyukyokuData = {
  type: 'DRAW' | 'ABORTIVE_DRAW'
  reason?: string
  tenpaiPlayers: string[]
}

type SoloRyukyokuData = {
  type: 'DRAW' | 'ABORTIVE_DRAW'
  reason?: string
  tenpaiPlayers: number[]
}

type SoloGameWithPlayers = SoloGame & {
  players: SoloPlayer[]
}

// プロセスの型拡張
declare global {
  interface Process {
    __socketio?: SocketIOInstance
  }
}

// WebSocketインスタンスを直接プロセスから取得
function getIO(): SocketIOInstance | null {
  if (process.__socketio) {
    console.log('🔌 API: Found WebSocket instance in process')
    return process.__socketio
  }
  console.log('🔌 API: No WebSocket instance found in process')
  return null
}

// 統合版流局スキーマ
const unifiedRyukyokuSchema = z.object({
  type: z.enum(['DRAW', 'ABORTIVE_DRAW']).default('DRAW'),
  reason: z.string().optional(),
  tenpaiPlayers: z.array(PlayerIdentifierSchema).default([]).refine(
    (players) => players.length <= 4,
    {
      message: 'テンパイ者は4人以下である必要があります'
    }
  )
})

/**
 * 統合版流局処理エンドポイント
 * マルチプレイとソロプレイの両方に対応
 */
export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) => {
  const body = await request.json()
  const validatedData = validateSchema(unifiedRyukyokuSchema, body)
  const { gameId } = await params

  console.log('Processing unified ryukyoku for gameId:', gameId)

  // まずマルチプレイゲームかどうか確認
  const multiGame = await prisma.game.findUnique({
    where: { id: gameId }
  })

  if (multiGame) {
    console.log('Processing as multiplayer ryukyoku')
    // マルチプレイ用に型変換
    const multiData: MultiplayerRyukyokuData = {
      type: validatedData.type || 'DRAW',
      reason: validatedData.reason,
      tenpaiPlayers: (validatedData.tenpaiPlayers || []).map(id => String(id))
    }
    return await processMultiplayerRyukyoku(gameId, multiData)
  }

  // ソロプレイゲームかどうか確認
  const soloGame = await prisma.soloGame.findUnique({
    where: { id: gameId },
    include: { players: true }
  })

  if (soloGame) {
    console.log('Processing as solo ryukyoku')
    // ソロプレイ用に型変換
    const soloData: SoloRyukyokuData = {
      type: validatedData.type || 'DRAW',
      reason: validatedData.reason,
      tenpaiPlayers: (validatedData.tenpaiPlayers || []).map(pos => {
        const numPos = typeof pos === 'number' ? pos : parseInt(String(pos))
        if (isNaN(numPos) || numPos < 0 || numPos > 3) {
          throw new AppError('INVALID_PLAYER_POSITION', `無効なプレイヤー位置: ${pos}`, {}, 400)
        }
        return numPos
      })
    }
    return await processSoloRyukyoku(gameId, soloData, soloGame)
  }

  throw new AppError('GAME_NOT_FOUND', 'ゲームが見つかりません', {}, 404)
}, '流局処理に失敗しました')

/**
 * マルチプレイゲームの流局処理
 */
async function processMultiplayerRyukyoku(gameId: string, validatedData: MultiplayerRyukyokuData) {
  const tenpaiPlayers = validatedData.tenpaiPlayers

  const pointManager = new PointManager(gameId)
  
  // 流局の理由を決定
  const reason = validatedData.reason || generateRyukyokuReason(validatedData.type, tenpaiPlayers.length)
  
  // 流局処理（内部で親ローテーションとゲーム終了判定も実行）
  const gameEndResult = await pointManager.handleRyukyoku(reason, tenpaiPlayers)

  // 更新されたゲーム状態
  const updatedGameState = await pointManager.getGameState()

  // ルームコードを取得してWebSocket通知
  const game = await pointManager.getGameInfo()
  const io = getIO()
  if (io && game?.roomCode) {
    if (gameEndResult.gameEnded) {
      console.log(`Multiplayer game ended: ${gameEndResult.reason}`)
      io.to(game.roomCode).emit('game_ended', {
        gameState: updatedGameState,
        reason: gameEndResult.reason,
        finalResults: true
      })
    } else {
      console.log(`Emitting ryukyoku to room ${game.roomCode}`)
      io.to(game.roomCode).emit('ryukyoku', {
        gameState: updatedGameState,
        reason
      })
    }
  }

  return createSuccessResponse({
    gameMode: 'MULTIPLAYER',
    gameState: updatedGameState,
    message: `流局: ${reason}`
  })
}

/**
 * ソロプレイゲームの流局処理
 */
async function processSoloRyukyoku(gameId: string, validatedData: SoloRyukyokuData, soloGame: SoloGameWithPlayers) {
  const tenpaiPlayers = validatedData.tenpaiPlayers

  // ゲーム状態を事前チェック
  if (soloGame.status !== 'PLAYING') {
    throw new AppError('GAME_NOT_PLAYING', 'ゲームが進行中ではありません', {}, 400)
  }

  // プレイヤー位置の妥当性チェック
  tenpaiPlayers.forEach(pos => validatePlayerPosition(pos))

  // リーチ者がテンパイ者に含まれているかチェック
  const currentReachPlayers = soloGame.players
    .filter((p) => p.isReach)
    .map((p) => p.position)
  
  const missingReachPlayers = currentReachPlayers.filter(pos => !tenpaiPlayers.includes(pos))
  if (missingReachPlayers.length > 0) {
    throw new AppError(
      'REACH_PLAYER_NOT_TENPAI', 
      'リーチしているプレイヤーはテンパイしている必要があります',
      { missingReachPlayers },
      400
    )
  }

  // 流局処理
  const pointManager = new SoloPointManager(gameId)
  
  // 流局の理由を生成
  const reason = validatedData.reason || generateRyukyokuReason(validatedData.type, tenpaiPlayers.length)

  // 流局処理（内部で親ローテーションとゲーム終了判定も実行）
  const gameEndResult = await pointManager.handleRyukyoku(reason, tenpaiPlayers)

  // 更新されたゲーム状態
  const updatedGameState = await pointManager.getGameState()

  return createSuccessResponse({
    gameMode: 'SOLO',
    gameState: updatedGameState,
    tenpaiPlayers,
    reachPlayers: currentReachPlayers,
    message: reason,
    gameEnded: gameEndResult.gameEnded,
    reason: gameEndResult.reason
  })
}

/**
 * 流局理由の自動生成
 */
function generateRyukyokuReason(
  type: 'DRAW' | 'ABORTIVE_DRAW',
  tenpaiCount: number
): string {
  if (type === 'ABORTIVE_DRAW') {
    return '途中流局'
  }
  
  if (tenpaiCount === 0) {
    return '全員ノーテン流局'
  } else if (tenpaiCount === 4) {
    return '全員テンパイ流局'  
  } else {
    return `${tenpaiCount}人テンパイ流局`
  }
}