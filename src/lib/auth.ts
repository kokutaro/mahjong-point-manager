import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export interface AuthenticatedUser {
  playerId: string
  name: string
  deviceId?: string
}

export async function getCurrentPlayer(): Promise<AuthenticatedUser | null> {
  try {
    const cookieStore = await cookies()
    const playerId = cookieStore.get('player_id')?.value

    if (!playerId) {
      return null
    }

    const player = await prisma.player.findUnique({
      where: { id: playerId }
    })

    if (!player) {
      return null
    }

    return {
      playerId: player.id,
      name: player.name,
      deviceId: player.deviceId || undefined
    }
  } catch (error) {
    console.error('Get current player failed:', error)
    return null
  }
}

export async function requireAuth(): Promise<AuthenticatedUser> {
  const player = await getCurrentPlayer()
  
  if (!player) {
    throw new Error('Authentication required')
  }
  
  return player
}

// プレイヤーがゲームに参加しているかチェック
export async function checkGameAccess(gameId: string, playerId: string): Promise<boolean> {
  try {
    const participant = await prisma.gameParticipant.findFirst({
      where: {
        gameId,
        playerId
      }
    })

    return !!participant
  } catch (error) {
    console.error('Game access check failed:', error)
    return false
  }
}

// ホスト権限チェック
export async function checkHostAccess(gameId: string, playerId: string): Promise<boolean> {
  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId }
    })

    return game?.hostPlayerId === playerId
  } catch (error) {
    console.error('Host access check failed:', error)
    return false
  }
}