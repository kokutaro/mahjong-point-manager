import { VoteState } from '@/components/VotingProgress'

// WebSocket 型定義
export interface SocketIOInstance {
  to(room: string): {
    emit(event: string, data: unknown): void
  }
}

// socket.tsからSocketIOServerをインポート
import { Server as SocketIOServer } from 'socket.io'

// グローバル型定義
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Process {
      __socketio?: SocketIOServer
    }
  }
  
  // eslint-disable-next-line no-var
  var gameVotes: Record<string, VoteState> | undefined
  // eslint-disable-next-line no-var
  var voteStartTimes: Record<string, string> | undefined
}

// グローバル変数として投票状態を管理（開発用）
export function initializeVoteGlobals() {
  if (!global.gameVotes) {
    global.gameVotes = {}
  }
  if (!global.voteStartTimes) {
    global.voteStartTimes = {}
  }
}

// WebSocketインスタンスを直接プロセスから取得
export function getIO(): SocketIOServer | null {
  if (process.__socketio) {
    return process.__socketio
  }
  return null
}

export {}