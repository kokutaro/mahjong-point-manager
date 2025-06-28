import { VoteState } from '@/components/VotingProgress'

// WebSocket 型定義
export interface SocketIOInstance {
  to(room: string): {
    emit(event: string, data: unknown): void
  }
}

// グローバル型定義
declare global {
  namespace NodeJS {
    interface Process {
      __socketio?: SocketIOInstance
    }
  }
  
  var gameVotes: Record<string, VoteState> | undefined
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
export function getIO(): SocketIOInstance | null {
  if (process.__socketio) {
    return process.__socketio
  }
  return null
}

export {}