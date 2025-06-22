const { Server: SocketIOServer } = require('socket.io')
const { PrismaClient } = require('@prisma/client')

let io = null

function initSocket(server) {
  console.log('🔌 JS: Initializing WebSocket server...')
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
    socket.on('join_room', async (data) => {
      try {
        const { roomCode, playerId } = data
        console.log(`Player ${playerId} attempting to join room ${roomCode}`)
        
        const prisma = new PrismaClient()
        
        try {
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
            // プレイヤーが参加者リストにない場合は警告だけ出してルームには参加させる
            console.log(`Warning: Player ${playerId} not in participant list for room ${roomCode}`)
            // socket.emit('error', { message: 'プレイヤーが登録されていません' })
            // return
          }

          // ソケットをルームに追加
          socket.join(roomCode.toUpperCase())
          console.log(`Player ${playerId} joined room ${roomCode}`)
          
          // 現在のゲーム状態を送信
          const gameState = await getGameState(game.id, prisma)
          socket.emit('game_state', gameState)
          
          // 他のプレイヤーに接続通知
          socket.to(roomCode.toUpperCase()).emit('player_connected', {
            playerId,
            gameState
          })
        } finally {
          await prisma.$disconnect()
        }
      } catch (error) {
        console.error('Room join error:', error)
        socket.emit('error', { message: 'ルーム参加に失敗しました' })
      }
    })

    // 切断処理
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
    })
  })

  // プロセスに保存
  process.__socketio = io
  console.log('🔌 JS: WebSocket instance saved to process')

  return io
}

async function getGameState(gameId, prismaInstance = null) {
  const prisma = prismaInstance || new PrismaClient()
  const shouldDisconnect = !prismaInstance

  try {
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
        isReach: p.isReach,
        isConnected: true // TODO: 実際の接続状態を管理
      })),
      currentRound: game.currentRound,
      currentOya: game.currentOya,
      honba: game.honba,
      kyotaku: game.kyotaku,
      gamePhase: game.status.toLowerCase()
    }
  } finally {
    if (shouldDisconnect) {
      await prisma.$disconnect()
    }
  }
}

function getIO() {
  if (io) {
    console.log('🔌 JS: getIO() returning local io instance')
    return io
  }
  
  if (process.__socketio) {
    io = process.__socketio
    console.log('🔌 JS: getIO() returning process.__socketio instance')
    return io
  }
  
  console.log('🔌 JS: getIO() - no WebSocket instance found')
  return null
}

module.exports = {
  initSocket,
  getIO
}