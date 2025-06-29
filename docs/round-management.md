# 親ローテーション・本場管理機能 詳細設計

## 概要

麻雀の親番管理と本場カウントを自動化する機能です。連荘・流局・親移動の判定を行い、正確な本場管理と親ローテーションを実現します。

## 機能要件

### 親番管理

- **起家設定**: 対局開始時の親決定
- **親ローテーション**: 子のアガリ時の自動親移動
- **親継続**: 親のアガリ・流局時の親継続
- **親表示**: 現在の親位置のリアルタイム表示

### 本場管理

- **本場カウント**: 連荘・流局による本場数増加
- **本場リセット**: 子アガリ時の本場リセット
- **本場支払い**: アガリ時の本場ボーナス計算
- **本場表示**: 現在の本場数表示

### 局進行管理

- **局カウント**: 東1局〜南4局の自動進行
- **終局判定**: 対局終了条件の判定
- **流局処理**: 各種流局の適切な処理

## データ構造

### 局進行状態

```typescript
interface RoundState {
  currentRound: number // 現在の局 (1=東1, 5=南1, etc.)
  currentOya: number // 現在の親位置 (0-3)
  startingOya: number // 起家位置 (0-3)
  honba: number // 本場数
  kyotaku: number // 供託数（リーチ棒）

  // 進行情報
  gameType: "TONPUU" | "HANCHAN"
  maxRounds: number // 最大局数
  isLastRound: boolean // 最終局フラグ
  isOvertime: boolean // 延長戦フラグ
}

interface RoundEvent {
  eventType: "AGARI" | "RYUKYOKU" | "ROUND_START" | "GAME_END"
  winnerId?: string // アガリ者
  isOya: boolean // 親かどうか
  roundBefore: RoundState // イベント前状態
  roundAfter: RoundState // イベント後状態
}
```

## コア実装

### RoundManager

```typescript
export class RoundManager {
  constructor(private prisma: PrismaClient) {}

  async processRoundEvent(
    gameId: string,
    event: RoundEventInput
  ): Promise<RoundState> {
    const currentState = await this.getCurrentRoundState(gameId)

    switch (event.type) {
      case "AGARI":
        return await this.processAgari(gameId, currentState, event)
      case "RYUKYOKU":
        return await this.processRyukyoku(gameId, currentState, event)
      default:
        throw new Error(`Unknown event type: ${event.type}`)
    }
  }

  private async processAgari(
    gameId: string,
    state: RoundState,
    event: AgariEvent
  ): Promise<RoundState> {
    const newState = { ...state }

    if (event.isOya) {
      // 親のアガリ → 連荘
      newState.honba += 1
      // 親・局は変更なし
    } else {
      // 子のアガリ → 親移動
      newState.currentOya = this.getNextOya(state.currentOya)
      newState.currentRound += 1
      newState.honba = 0
      newState.kyotaku = 0 // 供託クリア
    }

    // 終局判定
    newState.isLastRound = this.checkLastRound(newState)

    return await this.updateRoundState(gameId, newState)
  }

  private async processRyukyoku(
    gameId: string,
    state: RoundState,
    event: RyukyokuEvent
  ): Promise<RoundState> {
    const newState = { ...state }

    if (event.reason === "DRAW" || event.reason === "NAGASHI_MANGAN") {
      // 通常流局 → 親継続、本場増加
      newState.honba += 1
    } else {
      // 途中流局 → 親移動、本場リセット
      newState.currentOya = this.getNextOya(state.currentOya)
      newState.currentRound += 1
      newState.honba = 0
    }

    return await this.updateRoundState(gameId, newState)
  }

  private getNextOya(currentOya: number): number {
    return (currentOya + 1) % 4
  }

  private checkLastRound(state: RoundState): boolean {
    return state.currentRound >= state.maxRounds
  }
}
```

### 終局判定ロジック

```typescript
export class GameEndChecker {
  checkEndConditions(
    roundState: RoundState,
    participants: GameParticipant[]
  ): GameEndResult {
    // 規定局数終了
    if (roundState.currentRound > roundState.maxRounds) {
      return { shouldEnd: true, reason: "ROUND_LIMIT" }
    }

    // トビ終了
    const bankruptPlayer = participants.find((p) => p.currentPoints < 0)
    if (bankruptPlayer) {
      return { shouldEnd: true, reason: "BANKRUPTCY" }
    }

    // 30000点リーチ
    const reachPlayer = participants.find((p) => p.currentPoints >= 30000)
    if (reachPlayer && roundState.isLastRound) {
      return { shouldEnd: true, reason: "POINT_LIMIT" }
    }

    return { shouldEnd: false }
  }
}
```

## イベントフロー

### アガリ時の処理フロー

```text
1. アガリイベント発生
2. 親判定 (アガリ者の座席確認)
3. 親の場合:
   - 本場 +1
   - 親・局は継続
4. 子の場合:
   - 親を次の位置に移動
   - 局 +1
   - 本場・供託リセット
5. 終局判定
6. 状態更新・通知
```

### 流局時の処理フロー

```text
1. 流局イベント発生
2. 流局理由判定
3. 通常流局の場合:
   - 本場 +1
   - 親継続
4. 途中流局の場合:
   - 親移動
   - 局 +1
   - 本場リセット
5. 状態更新・通知
```

## UI/UX 連携

### 局表示コンポーネント

```typescript
const RoundDisplay: React.FC<{ roundState: RoundState }> = ({ roundState }) => {
  const getRoundName = (round: number) => {
    const winds = ['東', '南', '西', '北'];
    const windIndex = Math.floor((round - 1) / 4);
    const roundNumber = ((round - 1) % 4) + 1;
    return `${winds[windIndex]}${roundNumber}局`;
  };

  return (
    <div className="flex items-center gap-4">
      <span className="text-lg font-bold">
        {getRoundName(roundState.currentRound)}
      </span>
      <span className="text-sm">
        {roundState.honba}本場
      </span>
      <span className="text-sm">
        供託{roundState.kyotaku}本
      </span>
    </div>
  );
};
```

## 特殊ルール対応

### 連荘限度

```typescript
interface RenchanLimitRule {
  enabled: boolean
  maxRenchan: number // 最大連荘数
  forceRotation: boolean // 強制親移動
}
```

### 流局時親番処理

```typescript
interface RyukyokuRule {
  tengaiRyukyoku: boolean // 天和・地和・人和流局
  suufonRenda: boolean // 四風連打
  kyushukyuhai: boolean // 九種九牌
  forcedRotation: boolean // 強制親移動
}
```

## エラーハンドリング

### 状態不整合

- **親位置異常**: 0-3以外の値
- **局数異常**: 負の値・規定局数超過
- **本場数異常**: 負の値・異常な増加

### 復旧処理

- **状態再構築**: イベント履歴からの復元
- **整合性チェック**: 定期的な状態検証
- **自動修正**: 軽微な不整合の自動修正

## パフォーマンス最適化

### キャッシング

- 現在の局状態をメモリキャッシュ
- 頻繁な DB アクセスを削減

### バッチ処理

- 複数の状態更新を一括処理
- トランザクション内での原子性保証

## テスト設計

### 局進行テスト

```typescript
describe("RoundManager", () => {
  it("親のアガリで連荘する", async () => {
    const result = await roundManager.processAgari(gameId, {
      isOya: true,
      winnerId: "player1",
    })

    expect(result.honba).toBe(initialState.honba + 1)
    expect(result.currentOya).toBe(initialState.currentOya)
  })

  it("子のアガリで親移動する", async () => {
    const result = await roundManager.processAgari(gameId, {
      isOya: false,
      winnerId: "player2",
    })

    expect(result.currentOya).toBe((initialState.currentOya + 1) % 4)
    expect(result.honba).toBe(0)
  })
})
```
