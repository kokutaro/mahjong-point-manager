// 共通の基底型定義

export interface BasePlayerState {
  id: string
  name: string
  position: number
  points: number
  isReach: boolean
}

export interface BaseGameState {
  currentRound: number
  currentOya: number
  honba: number
  kyotaku: number
}

// マルチプレイ用プレイヤー型（既存との互換性維持）
export interface MultiGamePlayer extends BasePlayerState {
  playerId: string // idのエイリアス
  isConnected: boolean
}

// ソロプレイ用プレイヤー型
export type SoloGamePlayer = BasePlayerState

// マルチプレイ用ゲーム状態（既存との互換性維持）
export interface MultiGameState extends BaseGameState {
  gameId: string
  players: MultiGamePlayer[]
  gamePhase: "waiting" | "playing" | "finished"
}

// ソロプレイ用ゲーム状態
export interface SoloGameState extends BaseGameState {
  gameId: string
  players: SoloGamePlayer[]
  status: "WAITING" | "PLAYING" | "FINISHED"
}

// 点数入力データの型
export interface ScoreSubmissionData {
  winnerId: string
  han: number
  fu: number
  isTsumo: boolean
  loserId?: string
}

// 流局データの型
export interface RyukyokuSubmissionData {
  tenpaiPlayerIds: string[]
}

// ゲームモード
export type GameMode = "multi" | "solo"

// 汎用化されたコンポーネントのProps型
export interface BaseScoreInputFormProps<
  TGameState extends BaseGameState,
  TPlayer extends BasePlayerState,
> {
  gameState: TGameState & { players: TPlayer[] }
  currentPlayer?: TPlayer
  actionType: "tsumo" | "ron"
  preselectedWinnerId?: string
  mode: GameMode
  onSubmit: (scoreData: ScoreSubmissionData) => Promise<void>
  onCancel: () => void
  calculateScorePreview?: (data: {
    han: number
    fu: number
    isOya: boolean
    isTsumo: boolean
    honba: number
    kyotaku: number
  }) => Promise<{
    winnerGain: number
    loserLoss?: number
    payments: Record<string, number>
  }>
}

export interface BaseRyukyokuFormProps<TPlayer extends BasePlayerState> {
  players: TPlayer[]
  mode: GameMode
  onSubmit: (tenpaiPlayerIds: string[]) => Promise<void>
  onCancel: () => void
}

// 翻数と符数のオプション型
export interface HanOption {
  value: number
  label: string
}

export interface FuOption {
  value: number
  label: string
}
