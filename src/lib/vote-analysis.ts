import { VoteOption, VoteState } from '@/components/VotingProgress'

// 投票結果分析の結果型
export interface VoteResult {
  action: 'continue' | 'end' | 'wait'
  message: string
  details: {
    continueVotes: number
    endVotes: number
    pauseVotes: number
    totalPlayers: number
    votedPlayers: number
  }
}

// 投票データの型
export interface VoteData {
  gameId: string
  playerId: string
  vote: VoteOption
  votedAt: string
}

/**
 * 投票結果を分析して次のアクションを決定する
 * @param votes 現在の投票状態
 * @param totalPlayers 総プレイヤー数
 * @returns 投票結果と推奨アクション
 */
export function analyzeVotes(votes: VoteState, totalPlayers: number): VoteResult {
  const voteCount = Object.values(votes)
  const continueVotes = voteCount.filter(v => v === 'continue').length
  const endVotes = voteCount.filter(v => v === 'end').length
  const pauseVotes = voteCount.filter(v => v === 'pause').length
  const votedPlayers = voteCount.length
  
  const details = { 
    continueVotes, 
    endVotes, 
    pauseVotes, 
    totalPlayers, 
    votedPlayers 
  }
  
  // 全員投票済みの場合
  if (votedPlayers === totalPlayers) {
    if (endVotes === totalPlayers) {
      return {
        action: 'end',
        message: '全員がセッション終了に合意しました。セッションを終了します。',
        details
      }
    } else if (continueVotes > 0) {
      return {
        action: 'continue',
        message: `${continueVotes}名がセッション継続を希望しています。継続プロセスを開始します。`,
        details
      }
    } else {
      // 全員が保留の場合
      return {
        action: 'wait',
        message: '全員が保留を選択しました。再度投票を行ってください。',
        details
      }
    }
  }
  
  // まだ投票中
  return {
    action: 'wait',
    message: `投票待機中 (${votedPlayers}/${totalPlayers})`,
    details
  }
}

/**
 * 投票が有効かどうかを判定する
 * @param vote 投票選択肢
 * @returns 有効かどうか
 */
export function isValidVote(vote: unknown): vote is VoteOption {
  return ['continue', 'end', 'pause'].includes(vote as string)
}

/**
 * 投票状況をテキストで要約する
 * @param voteResult 投票結果
 * @returns 要約文字列
 */
export function summarizeVoteResult(voteResult: VoteResult): string {
  const { details } = voteResult
  const summary = []
  
  if (details.continueVotes > 0) {
    summary.push(`継続: ${details.continueVotes}票`)
  }
  
  if (details.endVotes > 0) {
    summary.push(`終了: ${details.endVotes}票`)
  }
  
  if (details.pauseVotes > 0) {
    summary.push(`保留: ${details.pauseVotes}票`)
  }
  
  const votedCount = `(${details.votedPlayers}/${details.totalPlayers}人投票済み)`
  
  return `${summary.join(', ')} ${votedCount}`
}

/**
 * 投票選択肢の表示名を取得
 * @param vote 投票選択肢
 * @returns 表示名
 */
export function getVoteDisplayName(vote: VoteOption): string {
  switch (vote) {
    case 'continue': return 'セッション継続'
    case 'end': return 'セッション終了'
    case 'pause': return '保留・様子見'
    default: return '不明'
  }
}

/**
 * 投票選択肢のアイコンを取得
 * @param vote 投票選択肢
 * @returns アイコン文字列
 */
export function getVoteIcon(vote: VoteOption): string {
  switch (vote) {
    case 'continue': return '🔄'
    case 'end': return '✋'
    case 'pause': return '⏸️'
    default: return '❓'
  }
}

/**
 * 投票の優先度を取得（継続 > 終了 > 保留）
 * @param vote 投票選択肢
 * @returns 優先度（数字が大きいほど優先）
 */
export function getVotePriority(vote: VoteOption): number {
  switch (vote) {
    case 'continue': return 3
    case 'end': return 2
    case 'pause': return 1
    default: return 0
  }
}

/**
 * 投票タイムアウトのデフォルト時間（ミリ秒）
 */
export const VOTE_TIMEOUT_DURATION = 5 * 60 * 1000 // 5分

/**
 * 投票開始からの経過時間を計算
 * @param startTime 投票開始時刻
 * @returns 経過時間（ミリ秒）
 */
export function getElapsedTime(startTime: string): number {
  return Date.now() - new Date(startTime).getTime()
}

/**
 * 投票残り時間を計算
 * @param startTime 投票開始時刻
 * @param timeoutDuration タイムアウト時間（ミリ秒）
 * @returns 残り時間（ミリ秒）、0以下の場合はタイムアウト
 */
export function getRemainingTime(startTime: string, timeoutDuration: number = VOTE_TIMEOUT_DURATION): number {
  const elapsed = getElapsedTime(startTime)
  return Math.max(0, timeoutDuration - elapsed)
}

/**
 * 時間をフォーマット（MM:SS形式）
 * @param milliseconds ミリ秒
 * @returns フォーマットされた時間文字列
 */
export function formatTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}