import { prisma } from '@/lib/prisma'
import { calculateScore } from '@/lib/score'
import { Server as HTTPServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'

export interface GameState {
  gameId: string
  players: GamePlayer[]
  currentRound: number
  currentDealer: number
  honba: number
  kyotaku: number
  gamePhase: 'waiting' | 'playing' | 'finished'
  winds: ('east' | 'south' | 'west' | 'north')[]
}

export interface GamePlayer {
  playerId: string
  name: string
  position: number
  points: number
  isReady: boolean
  isConnected: boolean
}

export interface GameEvent {
  type: 'join' | 'ready' | 'score' | 'dealer_change' | 'game_end'
  data: any
  timestamp: Date
}

let io: SocketIOServer | null = null

// Node.jsのprocessオブジェクトを使用してグローバル共有
export function initSocket(server: HTTPServer) {
  // 既存のインスタンスがあれば再利用
  if ((process as any).__socketio) {
    io = (process as any).__socketio
    console.log('🔌 Reusing existing WebSocket instance')
    return io
  }

  console.log('🔌 Creating new WebSocket instance')
  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? process.env.NEXTAUTH_URL 
        : ['http://localhost:3000', 'http://localhost:3001'],
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  })

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    // ルーム参加
    socket.on('join_room', async (data: { roomCode: string, playerId: string }) => {
      try {
        const { roomCode, playerId } = data
        
        // ゲーム存在確認
        const game = await prisma.game.findFirst({
          where: { roomCode: roomCode.toUpperCase() },
          include: {
            participants: {
              include: { player: true }
            }
          }
        })

        if (!game) {
          socket.emit('error', { message: 'ルームが見つかりません' })
          return
        }

        // プレイヤーが既に参加しているかチェック
        const existingParticipant = game.participants.find(p => p.playerId === playerId)
        
        if (!existingParticipant) {
          socket.emit('error', { message: 'プレイヤーが登録されていません' })
          return
        }

        // ソケットをルームに追加
        socket.join(roomCode.toUpperCase())
        console.log(`Player ${playerId} joined room ${roomCode}`)
        
        // 現在のゲーム状態を送信
        const gameState = await getGameState(game.id)
        socket.emit('game_state', gameState)
        
        // 他のプレイヤーに接続通知
        socket.to(roomCode.toUpperCase()).emit('player_connected', {
          playerId,
          gameState
        })
        
      } catch (error) {
        console.error('Room join error:', error)
        socket.emit('error', { message: 'ルーム参加に失敗しました' })
      }
    })

    // プレイヤー準備完了
    socket.on('player_ready', async (data: { gameId: string, playerId: string }) => {
      try {
        const { gameId, playerId } = data
        
        // TODO: プレイヤー準備状態をセッションまたは別テーブルで管理
        console.log(`Player ${playerId} is ready for game ${gameId}`)

        const gameState = await getGameState(gameId)
        const game = await prisma.game.findUnique({ where: { id: gameId } })
        
        if (game) {
          io?.to(game.roomCode).emit('game_state', gameState)
          
          // 全員準備完了でゲーム開始
          if (gameState.players.every(p => p.isReady) && gameState.players.length === 4) {
            await prisma.game.update({
              where: { id: gameId },
              data: { status: 'PLAYING' }
            })
            
            io?.to(game.roomCode).emit('game_start', gameState)
          }
        }
      } catch (error) {
        socket.emit('error', { message: 'プレイヤー準備に失敗しました' })
      }
    })

    // 点数計算イベント
    socket.on('calculate_score', async (data: {
      gameId: string
      winnerId: string
      han: number
      fu: number
      isTsumo: boolean
      loserId?: string
    }) => {
      try {
        const { gameId, winnerId, han, fu, isTsumo, loserId } = data
        
        const game = await prisma.game.findUnique({
          where: { id: gameId },
          include: {
            participants: true,
            settings: true
          }
        })

        if (!game) {
          socket.emit('error', { message: 'ゲームが見つかりません' })
          return
        }

        // 点数計算
        const winner = game.participants.find(p => p.playerId === winnerId)
        const isOya = winner?.position === game.currentOya
        
        const scoreResult = await calculateScore({
          han,
          fu,
          isOya: isOya || false,
          isTsumo,
          honba: game.honba,
          kyotaku: game.kyotaku
        })

        // 点数分配処理
        await distributePoints(gameId, winnerId, loserId, scoreResult, isTsumo)
        
        // 親の更新・本場の処理
        await updateGameState(gameId, winnerId, isOya || false)
        
        // 更新されたゲーム状態を通知
        const updatedGameState = await getGameState(gameId)
        io?.to(game.roomCode).emit('score_updated', {
          gameState: updatedGameState,
          scoreResult
        })
        
      } catch (error) {
        socket.emit('error', { message: '点数計算に失敗しました' })
      }
    })

    // 切断処理
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
    })
  });

  // processオブジェクトに保存
  (process as any).__socketio = io
  console.log('🔌 WebSocket instance saved to process object')

  return io
}

async function getGameState(gameId: string): Promise<GameState> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      participants: {
        include: { player: true },
        orderBy: { position: 'asc' }
      }
    }
  })

  if (!game) {
    throw new Error('Game not found')
  }

  return {
    gameId: game.id,
    players: game.participants.map(p => ({
      playerId: p.playerId,
      name: p.player.name,
      position: p.position,
      points: p.currentPoints,
      isReady: false, // TODO: セッション管理で実装
      isConnected: true // TODO: 実際の接続状態を管理
    })),
    currentRound: game.currentRound,
    currentDealer: game.currentOya,
    honba: game.honba,
    kyotaku: game.kyotaku,
    gamePhase: game.status as 'waiting' | 'playing' | 'finished',
    winds: ['east', 'south', 'west', 'north']
  }
}

async function distributePoints(
  gameId: string,
  winnerId: string,
  loserId: string | undefined,
  scoreResult: any,
  isTsumo: boolean
) {
  const participants = await prisma.gameParticipant.findMany({
    where: { gameId }
  })

  const winner = participants.find(p => p.playerId === winnerId)
  if (!winner) return

  const game = await prisma.game.findUnique({ where: { id: gameId } })
  const isOya = winner.position === (game?.currentOya || 0)

  if (isTsumo) {
    // ツモの場合の分配
    for (const participant of participants) {
      if (participant.playerId === winnerId) {
        // 勝者
        await prisma.gameParticipant.update({
          where: { id: participant.id },
          data: { currentPoints: participant.currentPoints + scoreResult.totalScore }
        })
      } else {
        // 敗者
        const payment = isOya ? scoreResult.payments.fromKo : 
                       (participant.position === 0 ? scoreResult.payments.fromOya : scoreResult.payments.fromKo)
        
        await prisma.gameParticipant.update({
          where: { id: participant.id },
          data: { currentPoints: participant.currentPoints - (payment || 0) }
        })
      }
    }
  } else {
    // ロンの場合
    if (loserId) {
      const loser = participants.find(p => p.playerId === loserId)
      if (loser) {
        await prisma.gameParticipant.update({
          where: { id: loser.id },
          data: { currentPoints: loser.currentPoints - scoreResult.totalScore }
        })
      }
    }
    
    await prisma.gameParticipant.update({
      where: { id: winner.id },
      data: { currentPoints: winner.currentPoints + scoreResult.totalScore }
    })
  }
}

async function updateGameState(gameId: string, winnerId: string, isOya: boolean) {
  const game = await prisma.game.findUnique({ where: { id: gameId } })
  if (!game) return

  let newOya = game.currentOya
  let newHonba = game.honba

  if (isOya) {
    // 親の和了：連荘
    newHonba += 1
  } else {
    // 子の和了：親交代
    newOya = (game.currentOya + 1) % 4
    newHonba = 0
  }

  await prisma.game.update({
    where: { id: gameId },
    data: {
      currentOya: newOya,
      honba: newHonba,
      kyotaku: 0 // 和了時に供託はクリア
    }
  })
}

export function getIO() {
  // まずローカル変数をチェック
  if (io) {
    console.log('🔌 getIO: Using local io instance')
    return io
  }
  
  // processオブジェクトをチェック
  if ((process as any).__socketio) {
    io = (process as any).__socketio
    console.log('🔌 getIO: Using process.__socketio instance')
    return io
  }
  
  console.log('🔌 Warning: WebSocket IO instance not found in both local and process')
  return null
}