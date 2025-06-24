import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { PointManager } from '@/lib/point-manager'
import { analyzeVotes, isValidVote, VoteResult } from '@/lib/vote-analysis'
import { VoteState } from '@/components/VotingProgress'

// WebSocketインスタンスを直接プロセスから取得
function getIO() {
  if ((process as any).__socketio) {
    console.log('🔌 Vote API: Found WebSocket instance in process')
    return (process as any).__socketio
  }
  console.log('🔌 Vote API: No WebSocket instance found in process')
  return null
}

// 投票リクエストのスキーマ
const voteSchema = z.object({
  vote: z.enum(['continue', 'end', 'pause'], {
    errorMap: () => ({ message: '有効な投票選択肢を選択してください (continue, end, pause)' })
  })
})

// 投票状態を管理（実際の実装ではRedisやDBの使用を推奨）
// gameId -> { playerId -> vote }
declare global {
  var gameVotes: Record<string, VoteState> | undefined
  var voteStartTimes: Record<string, string> | undefined
}

// グローバル変数として投票状態を管理（開発用）
if (!global.gameVotes) {
  global.gameVotes = {}
}
if (!global.voteStartTimes) {
  global.voteStartTimes = {}
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const body = await request.json()
    const { gameId } = await params
    const validatedData = voteSchema.parse(body)
    
    console.log(`🗳️ Vote API: Processing vote for game ${gameId}:`, validatedData)
    
    // 認証確認
    const player = await requireAuth()
    
    // ゲーム情報を取得
    const pointManager = new PointManager(gameId)
    const gameInfo = await pointManager.getGameInfo()
    
    if (!gameInfo) {
      return NextResponse.json({
        success: false,
        error: { message: 'ゲームが見つかりません' }
      }, { status: 404 })
    }
    
    // セッションが存在することを確認
    if (!gameInfo.sessionId) {
      return NextResponse.json({
        success: false,
        error: { message: 'セッションが存在しません' }
      }, { status: 400 })
    }
    
    // 投票状態を取得
    const gameVotes = global.gameVotes!
    const voteStartTimes = global.voteStartTimes!
    
    // 投票の初期化（初回投票時）
    if (!gameVotes[gameId]) {
      gameVotes[gameId] = {}
      voteStartTimes[gameId] = new Date().toISOString()
    }
    
    // 投票を記録
    gameVotes[gameId][player.playerId] = validatedData.vote
    
    console.log(`🗳️ Vote recorded: ${player.name} voted ${validatedData.vote}`)
    console.log(`🗳️ Current votes for game ${gameId}:`, gameVotes[gameId])
    
    // 総プレイヤー数を取得（固定で4人とするか、動的に取得）
    const totalPlayers = 4
    
    // 投票結果を分析
    const voteResult = analyzeVotes(gameVotes[gameId], totalPlayers)
    
    console.log(`🗳️ Vote analysis result:`, voteResult)
    
    // WebSocket通知
    const io = getIO()
    if (io && gameInfo.roomCode) {
      // 投票状況をブロードキャスト
      io.to(gameInfo.roomCode).emit('session_vote_update', {
        votes: gameVotes[gameId],
        result: voteResult,
        voterName: player.name
      })
      
      console.log(`🔌 Broadcasted vote update to room ${gameInfo.roomCode}`)
      
      // 決定した場合の追加処理
      if (voteResult.action === 'end' && voteResult.details.votedPlayers === totalPlayers) {
        // セッション終了処理
        console.log('🏁 All players voted to end session, forcing end...')
        
        try {
          await pointManager.forceEndGame('全員合意による終了')
          
          io.to(gameInfo.roomCode).emit('session_ended_by_consensus', {
            reason: '全員合意による終了',
            voteDetails: voteResult.details
          })
          
          console.log('🏁 Session ended by consensus')
          
          // 投票状態をクリア
          if (gameVotes) {
            delete gameVotes[gameId]
          }
          if (voteStartTimes) {
            delete voteStartTimes[gameId]
          }
          
        } catch (endError) {
          console.error('Failed to end session:', endError)
          // エラーが発生してもレスポンスは投票成功として返す
        }
        
      } else if (voteResult.action === 'continue' && voteResult.details.votedPlayers === totalPlayers) {
        // 継続プロセス開始
        console.log('🔄 Continue process triggered by votes')

        io.to(gameInfo.roomCode).emit('session_continue_agreed', {
          continueVotes: voteResult.details.continueVotes
        })

        try {
          const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
          const res = await fetch(`${baseUrl}/api/game/${gameId}/rematch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ continueSession: true })
          })
          const data = await res.json()

          if (res.ok && data.success) {
            io.to(gameInfo.roomCode).emit('new-room-ready', {
              roomCode: data.data.roomCode,
              gameId: data.data.gameId,
              sessionId: data.data.sessionId
            })
            console.log(`🔄 Successfully created new room ${data.data.roomCode} for continuation`)
          } else {
            console.error('Failed to create new room:', data.error?.message)
            io.to(gameInfo.roomCode).emit('error', { message: '新しいルーム作成に失敗しました' })
          }
        } catch (err) {
          console.error('Error creating new room:', err)
          io.to(gameInfo.roomCode).emit('error', { message: '新しいルーム作成に失敗しました' })
        }

        // 投票状態をクリア
        if (gameVotes) {
          delete gameVotes[gameId]
        }
        if (voteStartTimes) {
          delete voteStartTimes[gameId]
        }
        
      } else if (voteResult.action === 'wait' && voteResult.details.votedPlayers === totalPlayers) {
        // 全員が保留の場合は投票をリセット
        if (voteResult.details.pauseVotes === totalPlayers) {
          console.log('⏸️ All players voted pause, resetting votes...')
          
          setTimeout(() => {
            if (gameVotes) {
              delete gameVotes[gameId]
            }
            if (voteStartTimes) {
              delete voteStartTimes[gameId]
            }
            
            io.to(gameInfo.roomCode).emit('vote_timeout', {
              reason: '全員が保留を選択したため投票をリセットしました'
            })
          }, 3000) // 3秒後にリセット
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      data: {
        vote: validatedData.vote,
        currentVotes: gameVotes[gameId],
        result: voteResult,
        voteStartTime: voteStartTimes[gameId]
      }
    })
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: {
          message: 'バリデーションエラー',
          details: error.errors
        }
      }, { status: 400 })
    }
    
    // 認証エラーのハンドリング
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({
        success: false,
        error: { message: '認証が必要です' }
      }, { status: 401 })
    }
    
    console.error('Vote session failed:', error)
    return NextResponse.json({
      success: false,
      error: { 
        message: '投票処理に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 })
  }
}

// 投票取り消しのエンドポイント
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params
    
    // 認証確認
    const player = await requireAuth()
    
    console.log(`🗳️ Cancel vote for player ${player.name} in game ${gameId}`)
    
    // 投票を削除
    if (gameVotes && gameVotes[gameId] && gameVotes[gameId][player.playerId]) {
      delete gameVotes[gameId][player.playerId]
      
      // 誰も投票していない場合は投票をリセット
      if (Object.keys(gameVotes[gameId]).length === 0) {
        delete gameVotes[gameId]
        if (voteStartTimes) {
          delete voteStartTimes[gameId]
        }
      }
    }
    
    // ゲーム情報を取得してWebSocket通知
    const pointManager = new PointManager(gameId)
    const gameInfo = await pointManager.getGameInfo()
    
    if (gameInfo && gameInfo.roomCode) {
      const io = getIO()
      if (io) {
        const currentVotes = (gameVotes && gameVotes[gameId]) || {}
        const voteResult = analyzeVotes(currentVotes, 4)
        
        io.to(gameInfo.roomCode).emit('session_vote_update', {
          votes: currentVotes,
          result: voteResult,
          voterName: player.name
        })
        
        console.log(`🔌 Broadcasted vote cancellation to room ${gameInfo.roomCode}`)
      }
    }
    
    return NextResponse.json({
      success: true,
      data: {
        message: '投票を取り消しました',
        currentVotes: (gameVotes && gameVotes[gameId]) || {}
      }
    })
    
  } catch (error) {
    console.error('Cancel vote failed:', error)
    return NextResponse.json({
      success: false,
      error: { message: '投票の取り消しに失敗しました' }
    }, { status: 500 })
  }
}