# リーチ・供託管理機能 詳細設計

## 概要

リーチ宣言の管理と供託（リーチ棒・本場棒）の計算・分配を行う機能です。リーチ状態の追跡、供託の蓄積、流局時の処理を自動化します。

## 機能要件

### リーチ管理

- **リーチ宣言**: プレイヤーのリーチ宣言と1000点支払い
- **リーチ状態追跡**: 各プレイヤーのリーチ状態管理
- **リーチ解除**: 流局・アガリ時の状態クリア
- **リーチ棒管理**: 供託としてのリーチ棒追跡

### 供託管理

- **供託蓄積**: リーチ棒の累積管理
- **供託分配**: アガリ時の供託分配
- **流局時処理**: 流局時の供託継続
- **供託表示**: 現在の供託数表示

### 制約・バリデーション

- **重複リーチ防止**: 既にリーチ中の再宣言禁止
- **点数不足チェック**: 1000点未満時のリーチ禁止
- **タイミング制限**: 適切なタイミングでのみリーチ許可

## データ構造

### リーチ状態

```typescript
interface ReachState {
  playerId: string;
  isReach: boolean;
  reachRound?: number;       // リーチした局
  reachTurn?: number;        // リーチしたターン
  declaredAt: Date;
  canWin: boolean;           // 和了可能状態
}

interface KyotakuState {
  gameId: string;
  reachSticks: number;       // リーチ棒の数
  honbaSticks: number;       // 本場棒の数（別途管理）
  totalValue: number;        // 総価値（1000×リーチ棒数）
  history: KyotakuEvent[];   // 供託履歴
}

interface KyotakuEvent {
  eventType: 'REACH_DECLARED' | 'KYOTAKU_DISTRIBUTED' | 'ROUND_END';
  playerId?: string;
  amount: number;
  round: number;
  timestamp: Date;
}
```

## コア実装

### ReachManager

```typescript
export class ReachManager {
  constructor(
    private prisma: PrismaClient,
    private pointsManager: PointsManagerService
  ) {}
  
  async declareReach(
    gameId: string,
    playerId: string,
    round: number
  ): Promise<ReachResult> {
    // バリデーション
    await this.validateReachDeclaration(gameId, playerId);
    
    return await this.prisma.$transaction(async (tx) => {
      // プレイヤーのリーチ状態更新
      await tx.gameParticipant.update({
        where: { gameId_playerId: { gameId, playerId } },
        data: {
          isReach: true,
          reachRound: round,
          currentPoints: { decrement: 1000 }
        }
      });
      
      // 供託数増加
      await tx.game.update({
        where: { id: gameId },
        data: { kyotaku: { increment: 1 } }
      });
      
      // イベント記録
      await this.recordReachEvent(tx, gameId, playerId, round);
      
      return await this.getUpdatedState(tx, gameId);
    });
  }
  
  private async validateReachDeclaration(
    gameId: string,
    playerId: string
  ): Promise<void> {
    const participant = await this.prisma.gameParticipant.findUnique({
      where: { gameId_playerId: { gameId, playerId } }
    });
    
    if (!participant) {
      throw new PlayerNotFoundError(playerId);
    }
    
    if (participant.isReach) {
      throw new AlreadyReachError(playerId);
    }
    
    if (participant.currentPoints < 1000) {
      throw new InsufficientPointsError(playerId, 1000, participant.currentPoints);
    }
  }
  
  async distributeKyotaku(
    gameId: string,
    winnerId: string
  ): Promise<KyotakuDistribution> {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId }
    });
    
    if (!game || game.kyotaku === 0) {
      return { amount: 0, distributed: false };
    }
    
    const kyotakuValue = game.kyotaku * 1000;
    
    return await this.prisma.$transaction(async (tx) => {
      // 勝者に供託分配
      await tx.gameParticipant.update({
        where: { gameId_playerId: { gameId, playerId: winnerId } },
        data: { currentPoints: { increment: kyotakuValue } }
      });
      
      // 供託クリア
      await tx.game.update({
        where: { id: gameId },
        data: { kyotaku: 0 }
      });
      
      // 分配イベント記録
      await this.recordKyotakuDistribution(tx, gameId, winnerId, kyotakuValue);
      
      return { amount: kyotakuValue, distributed: true };
    });
  }
}
```

### 流局時処理

```typescript
export class RyukyokuProcessor {
  async processRyukyoku(
    gameId: string,
    reason: RyukyokuReason
  ): Promise<RyukyokuResult> {
    return await this.prisma.$transaction(async (tx) => {
      // 全員のリーチ状態解除
      await tx.gameParticipant.updateMany({
        where: { gameId },
        data: { 
          isReach: false,
          reachRound: null
        }
      });
      
      // 供託は継続（次局に持ち越し）
      // kyotaku値はそのまま維持
      
      // 流局イベント記録
      await this.recordRyukyokuEvent(tx, gameId, reason);
      
      return {
        kyotakuCarriedOver: await this.getCurrentKyotaku(tx, gameId),
        reachStatesCleared: true
      };
    });
  }
}
```

## UI/UX 連携

### リーチボタン・表示

```typescript
const ReachButton: React.FC<{ 
  playerId: string; 
  canReach: boolean; 
  onReach: () => void;
}> = ({ playerId, canReach, onReach }) => {
  return (
    <Button
      variant={canReach ? "default" : "disabled"}
      disabled={!canReach}
      onClick={onReach}
      className="reach-button"
    >
      リーチ
    </Button>
  );
};

const KyotakuDisplay: React.FC<{ kyotaku: number }> = ({ kyotaku }) => {
  return (
    <div className="kyotaku-display">
      <span className="label">供託:</span>
      <span className="value">{kyotaku}本</span>
      <span className="points">({kyotaku * 1000}点)</span>
    </div>
  );
};
```

## イベントフロー

### リーチ宣言フロー

```text
1. プレイヤー: リーチボタンクリック
2. クライアント: リーチ可能性チェック
3. サーバー: リーチ宣言バリデーション
4. サーバー: 点数減算・リーチ状態更新・供託増加
5. サーバー: 全プレイヤーに状態変更通知
6. クライアント: UI更新（リーチマーク表示）
```

### 供託分配フロー

```text
1. アガリイベント発生
2. サーバー: 供託数確認
3. サーバー: 勝者に供託分配
4. サーバー: 供託数リセット
5. サーバー: 分配結果通知
6. クライアント: 点数・供託表示更新
```

## 特殊ケース対応

### ダブルリーチ

```typescript
interface DoubleReachRule {
  enabled: boolean;
  bonusValue: number;        // ボーナス翻数
  firstTurnOnly: boolean;    // 第一ツモでのみ有効
}
```

### 一発消し

```typescript
interface IppatsuRule {
  enabled: boolean;
  cancelConditions: string[]; // ['CHII', 'PON', 'KAN']
}
```

## エラーハンドリング

### リーチエラー

- **AlreadyReachError**: 既にリーチ中
- **InsufficientPointsError**: 点数不足
- **InvalidTimingError**: 不正なタイミング
- **GameStateError**: ゲーム状態不正

### 復旧処理

- **状態整合性チェック**: リーチ状態と点数の整合性
- **供託再計算**: イベント履歴からの供託数復元
- **エラー時ロールバック**: 不完全な操作の取り消し

## バリデーション

### リーチ宣言時

```typescript
const validateReachDeclaration = (
  participant: GameParticipant,
  gameState: GameState
): ValidationResult => {
  const errors: string[] = [];
  
  if (participant.isReach) {
    errors.push('既にリーチ中です');
  }
  
  if (participant.currentPoints < 1000) {
    errors.push('点数が不足しています');
  }
  
  if (gameState.status !== 'PLAYING') {
    errors.push('対局中ではありません');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};
```

## テスト設計

### リーチ機能テスト

```typescript
describe('ReachManager', () => {
  it('正常にリーチ宣言できる', async () => {
    const result = await reachManager.declareReach(gameId, playerId, 3);
    
    expect(result.participant.isReach).toBe(true);
    expect(result.participant.currentPoints).toBe(24000); // 25000 - 1000
    expect(result.kyotaku).toBe(1);
  });
  
  it('点数不足時はリーチできない', async () => {
    // プレイヤーの点数を500に設定
    await setupPlayerPoints(playerId, 500);
    
    await expect(
      reachManager.declareReach(gameId, playerId, 3)
    ).rejects.toThrow(InsufficientPointsError);
  });
  
  it('供託が正しく分配される', async () => {
    // 供託3本の状態で
    await setupKyotaku(gameId, 3);
    
    const result = await reachManager.distributeKyotaku(gameId, winnerId);
    
    expect(result.amount).toBe(3000);
    expect(result.distributed).toBe(true);
  });
});
```
