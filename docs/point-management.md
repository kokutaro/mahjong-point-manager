# 点棒管理機能 詳細設計

## 概要

麻雀対局における点棒の管理機能です。リアルタイムでの点数加減算、データ整合性保証、WebSocket同期によるマルチプレイヤー対応を実現します。

## 機能要件

### 基本点棒管理

- **リアルタイム点数更新**: 各プレイヤーの持ち点をリアルタイム管理
- **点数加減算**: ツモ・ロン・リーチによる自動点数計算と分配
- **整合性保証**: 点数の総和が常に一定であることを保証
- **履歴管理**: 全ての点数変動を記録・追跡可能

### 同期機能

- **マルチプレイヤー同期**: 4人全員の画面をリアルタイム同期
- **楽観的ロック**: 競合状態を防ぐ排他制御
- **エラー復旧**: 通信断・エラー時の自動復旧
- **整合性チェック**: 定期的な点数整合性検証

## データ構造

### 点棒状態管理

```typescript
interface PointsState {
  gameId: string;
  participants: Array<{
    playerId: string;
    position: number;        // 座席位置 (0-3)
    currentPoints: number;   // 現在の持ち点
    pointsHistory: PointChange[]; // 点数変動履歴
    isReach: boolean;        // リーチ状態
    reachRound?: number;     // リーチした局
  }>;
  
  // 整合性情報
  totalPoints: number;       // 総点数 (常に100000)
  lastUpdated: Date;         // 最終更新時刻
  version: number;           // 楽観的ロック用バージョン
}

interface PointChange {
  id: string;
  round: number;             // 発生局
  eventType: 'TSUMO' | 'RON' | 'REACH' | 'PENALTY' | 'CORRECTION';
  change: number;            // 点数変動 (+/-)
  reason: string;            // 変動理由
  timestamp: Date;
  relatedPlayerIds: string[]; // 関連プレイヤー
}
```

### 点数操作コマンド

```typescript
interface PointsCommand {
  commandId: string;         // 冪等性用ID
  gameId: string;
  eventType: PointsEventType;
  data: PointsEventData;
  timestamp: Date;
  executedBy: string;        // 実行者
  
  // 楽観的ロック
  expectedVersion: number;
}

type PointsEventType = 
  | 'APPLY_SCORE'     // 点数計算結果適用
  | 'REACH'           // リーチ宣言
  | 'UNREACH'         // リーチ解除（流局時）
  | 'PENALTY'         // ペナルティ
  | 'CORRECTION'      // 手動修正
  | 'RESET'           // リセット

interface ApplyScoreData {
  scoreResult: ScoreResult;
  honba: number;
  kyotaku: number;
}

interface ReachData {
  playerId: string;
  round: number;
}

interface PenaltyData {
  playerId: string;
  amount: number;
  reason: string;
}
```

## 点棒管理サービス

### PointsManagerService

```typescript
export class PointsManagerService {
  private readonly TOTAL_POINTS = 100000; // 総点数固定値
  
  constructor(
    private prisma: PrismaClient,
    private socketService: SocketService
  ) {}
  
  /**
   * 点数状態取得
   */
  async getPointsState(gameId: string): Promise<PointsState> {
    const participants = await this.prisma.gameParticipant.findMany({
      where: { gameId },
      include: { player: true },
      orderBy: { position: 'asc' }
    });
    
    const pointsHistory = await this.getPointsHistory(gameId);
    
    return {
      gameId,
      participants: participants.map(p => ({
        playerId: p.playerId,
        position: p.position,
        currentPoints: p.currentPoints,
        pointsHistory: pointsHistory.filter(h => h.playerId === p.playerId),
        isReach: p.isReach,
        reachRound: p.reachRound
      })),
      totalPoints: participants.reduce((sum, p) => sum + p.currentPoints, 0),
      lastUpdated: new Date(),
      version: await this.getGameVersion(gameId)
    };
  }
  
  /**
   * 点数コマンド実行
   */
  async executePointsCommand(command: PointsCommand): Promise<PointsState> {
    // 冪等性チェック
    if (await this.isCommandExecuted(command.commandId)) {
      return await this.getPointsState(command.gameId);
    }
    
    return await this.prisma.$transaction(async (tx) => {
      // 楽観的ロック確認
      await this.verifyGameVersion(tx, command.gameId, command.expectedVersion);
      
      // コマンド実行
      const newState = await this.processCommand(tx, command);
      
      // 整合性チェック
      await this.verifyPointsIntegrity(newState);
      
      // コマンド履歴保存
      await this.saveCommandHistory(tx, command);
      
      // バージョン更新
      await this.incrementGameVersion(tx, command.gameId);
      
      // WebSocket通知
      await this.notifyPointsUpdate(newState);
      
      return newState;
    });
  }
  
  /**
   * コマンド処理ディスパッチ
   */
  private async processCommand(
    tx: PrismaTransaction, 
    command: PointsCommand
  ): Promise<PointsState> {
    switch (command.eventType) {
      case 'APPLY_SCORE':
        return await this.applyScore(tx, command);
        
      case 'REACH':
        return await this.applyReach(tx, command);
        
      case 'UNREACH':
        return await this.applyUnreach(tx, command);
        
      case 'PENALTY':
        return await this.applyPenalty(tx, command);
        
      case 'CORRECTION':
        return await this.applyCorrection(tx, command);
        
      default:
        throw new Error(`Unknown command type: ${command.eventType}`);
    }
  }
  
  /**
   * 点数計算結果適用
   */
  private async applyScore(
    tx: PrismaTransaction, 
    command: PointsCommand
  ): Promise<PointsState> {
    const { scoreResult } = command.data as ApplyScoreData;
    
    // 勝者への加算
    await tx.gameParticipant.update({
      where: { 
        gameId_playerId: { 
          gameId: command.gameId, 
          playerId: scoreResult.distribution.winner.playerId 
        }
      },
      data: {
        currentPoints: {
          increment: scoreResult.withBonuses.totalReceives
        }
      }
    });
    
    // 敗者からの減算
    for (const loser of scoreResult.distribution.losers) {
      await tx.gameParticipant.update({
        where: {
          gameId_playerId: {
            gameId: command.gameId,
            playerId: loser.playerId
          }
        },
        data: {
          currentPoints: {
            decrement: loser.pays
          }
        }
      });
    }
    
    // 履歴記録
    await this.recordPointChanges(tx, command.gameId, scoreResult);
    
    return await this.getPointsStateInTransaction(tx, command.gameId);
  }
  
  /**
   * リーチ適用
   */
  private async applyReach(
    tx: PrismaTransaction,
    command: PointsCommand
  ): Promise<PointsState> {
    const { playerId, round } = command.data as ReachData;
    
    // リーチ棒支払い (1000点)
    await tx.gameParticipant.update({
      where: {
        gameId_playerId: {
          gameId: command.gameId,
          playerId
        }
      },
      data: {
        currentPoints: { decrement: 1000 },
        isReach: true,
        reachRound: round
      }
    });
    
    // ゲームの供託数増加
    await tx.game.update({
      where: { id: command.gameId },
      data: { kyotaku: { increment: 1 } }
    });
    
    return await this.getPointsStateInTransaction(tx, command.gameId);
  }
  
  /**
   * 整合性検証
   */
  private async verifyPointsIntegrity(state: PointsState): Promise<void> {
    const totalPoints = state.participants.reduce(
      (sum, p) => sum + p.currentPoints, 0
    );
    
    if (totalPoints !== this.TOTAL_POINTS) {
      throw new PointsIntegrityError(
        `Points sum mismatch: expected ${this.TOTAL_POINTS}, got ${totalPoints}`
      );
    }
    
    // マイナス点数チェック
    const negativePlayer = state.participants.find(p => p.currentPoints < 0);
    if (negativePlayer) {
      console.warn(`Player ${negativePlayer.playerId} has negative points: ${negativePlayer.currentPoints}`);
      // マイナス点数は警告のみ（トビありルールでは許可）
    }
  }
  
  /**
   * WebSocket通知
   */
  private async notifyPointsUpdate(state: PointsState): Promise<void> {
    const roomCode = await this.getRoomCode(state.gameId);
    
    this.socketService.emitToRoom(roomCode, 'points-updated', {
      participants: state.participants.map(p => ({
        playerId: p.playerId,
        currentPoints: p.currentPoints,
        isReach: p.isReach
      })),
      totalPoints: state.totalPoints,
      version: state.version
    });
  }
}
```

## WebSocket同期

### リアルタイム同期イベント

```typescript
// Server → All Clients
interface PointsUpdatedEvent {
  participants: Array<{
    playerId: string;
    currentPoints: number;
    isReach: boolean;
  }>;
  totalPoints: number;
  version: number;
  timestamp: string;
}

// Client → Server
interface PointsSyncRequest {
  gameId: string;
  lastKnownVersion: number;
}

// Server → Client (差分同期)
interface PointsSyncResponse {
  currentState: PointsState;
  missedEvents: PointChange[];
  conflicts?: ConflictInfo[];
}
```

### 競合解決

```typescript
export class PointsConflictResolver {
  /**
   * 競合検出と解決
   */
  async resolveConflicts(
    clientState: PointsState,
    serverState: PointsState
  ): Promise<ConflictResolution> {
    const conflicts: ConflictInfo[] = [];
    
    // バージョン競合チェック
    if (clientState.version !== serverState.version) {
      conflicts.push({
        type: 'VERSION_MISMATCH',
        clientVersion: clientState.version,
        serverVersion: serverState.version
      });
    }
    
    // 点数不整合チェック
    for (let i = 0; i < clientState.participants.length; i++) {
      const clientP = clientState.participants[i];
      const serverP = serverState.participants[i];
      
      if (clientP.currentPoints !== serverP.currentPoints) {
        conflicts.push({
          type: 'POINTS_MISMATCH',
          playerId: clientP.playerId,
          clientPoints: clientP.currentPoints,
          serverPoints: serverP.currentPoints
        });
      }
    }
    
    // 解決戦略: サーバー状態を優先
    return {
      resolution: 'SERVER_WINS',
      resolvedState: serverState,
      conflicts
    };
  }
}
```

## フロントエンド状態管理

### Zustand Store

```typescript
interface PointsStore {
  // 状態
  pointsState: PointsState | null;
  isLoading: boolean;
  lastError: string | null;
  
  // 同期関連
  isConnected: boolean;
  pendingCommands: PointsCommand[];
  
  // アクション
  loadPointsState: (gameId: string) => Promise<void>;
  executeCommand: (command: PointsCommand) => Promise<void>;
  syncWithServer: () => Promise<void>;
  
  // WebSocket連携
  handlePointsUpdate: (event: PointsUpdatedEvent) => void;
  handleConnectionChange: (connected: boolean) => void;
}

export const usePointsStore = create<PointsStore>((set, get) => ({
  pointsState: null,
  isLoading: false,
  lastError: null,
  isConnected: false,
  pendingCommands: [],
  
  loadPointsState: async (gameId: string) => {
    set({ isLoading: true, lastError: null });
    try {
      const response = await fetch(`/api/games/${gameId}/points`);
      const data = await response.json();
      
      if (!data.success) throw new Error(data.error.message);
      
      set({ pointsState: data.data, isLoading: false });
    } catch (error) {
      set({ lastError: error.message, isLoading: false });
    }
  },
  
  executeCommand: async (command: PointsCommand) => {
    const { isConnected, pointsState } = get();
    
    if (!isConnected) {
      // オフライン時はペンディングキューに追加
      set(state => ({
        pendingCommands: [...state.pendingCommands, command]
      }));
      return;
    }
    
    try {
      // 楽観的更新
      const optimisticState = applyCommandOptimistically(pointsState, command);
      set({ pointsState: optimisticState });
      
      // サーバー送信
      const socket = useSocket();
      socket.emit('points-command', command);
      
    } catch (error) {
      // エラー時は元の状態に戻す
      await get().syncWithServer();
      throw error;
    }
  },
  
  handlePointsUpdate: (event: PointsUpdatedEvent) => {
    const { pointsState } = get();
    
    // バージョンチェック
    if (pointsState && event.version <= pointsState.version) {
      return; // 古い更新は無視
    }
    
    // 状態更新
    set(state => ({
      pointsState: {
        ...state.pointsState!,
        participants: event.participants,
        totalPoints: event.totalPoints,
        version: event.version,
        lastUpdated: new Date(event.timestamp)
      }
    }));
  },
  
  syncWithServer: async () => {
    const { pointsState } = get();
    const socket = useSocket();
    
    socket.emit('points-sync-request', {
      gameId: pointsState?.gameId,
      lastKnownVersion: pointsState?.version || 0
    });
  }
}));
```

### React Components

```typescript
// 点数表示コンポーネント
export const PointsDisplay: React.FC<{ gameId: string }> = ({ gameId }) => {
  const { pointsState, isLoading, loadPointsState } = usePointsStore();
  
  useEffect(() => {
    loadPointsState(gameId);
  }, [gameId, loadPointsState]);
  
  if (isLoading || !pointsState) {
    return <PointsLoadingSkeleton />;
  }
  
  return (
    <div className="grid grid-cols-2 gap-4">
      {pointsState.participants.map((participant, index) => (
        <PlayerPointsCard
          key={participant.playerId}
          participant={participant}
          position={index}
        />
      ))}
      
      <PointsSummary 
        totalPoints={pointsState.totalPoints}
        lastUpdated={pointsState.lastUpdated}
      />
    </div>
  );
};

// 個別プレイヤー点数カード
const PlayerPointsCard: React.FC<{
  participant: PointsState['participants'][0];
  position: number;
}> = ({ participant, position }) => {
  const positionNames = ['東', '南', '西', '北'];
  
  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-2">
        <span className="font-semibold">{positionNames[position]}</span>
        {participant.isReach && (
          <Badge variant="destructive">リーチ</Badge>
        )}
      </div>
      
      <div className="text-2xl font-bold mb-1">
        {participant.currentPoints.toLocaleString()}
      </div>
      
      <div className="text-sm text-gray-500">
        最新変動: {getLastPointChange(participant.pointsHistory)}
      </div>
    </Card>
  );
};
```

## エラーハンドリング

### エラー種別

```typescript
export class PointsIntegrityError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'PointsIntegrityError';
  }
}

export class PointsVersionConflictError extends Error {
  constructor(
    message: string, 
    public expectedVersion: number,
    public actualVersion: number
  ) {
    super(message);
    this.name = 'PointsVersionConflictError';
  }
}

export class InsufficientPointsError extends Error {
  constructor(
    message: string,
    public playerId: string,
    public requiredPoints: number,
    public currentPoints: number
  ) {
    super(message);
    this.name = 'InsufficientPointsError';
  }
}
```

### 復旧処理

```typescript
export class PointsRecoveryService {
  /**
   * 状態復旧
   */
  async recoverPointsState(gameId: string): Promise<PointsState> {
    // 1. 最新のイベント履歴から再構築
    const events = await this.getGameEvents(gameId);
    const reconstructedState = await this.reconstructFromEvents(events);
    
    // 2. 現在のDB状態と比較
    const currentState = await this.getCurrentState(gameId);
    
    // 3. 不整合があれば修正
    if (!this.statesMatch(reconstructedState, currentState)) {
      await this.correctStateDiscrepancy(gameId, reconstructedState);
    }
    
    return reconstructedState;
  }
  
  /**
   * イベントからの状態再構築
   */
  private async reconstructFromEvents(events: GameEvent[]): Promise<PointsState> {
    let state: PointsState = this.createInitialState();
    
    for (const event of events.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
      state = await this.applyEventToState(state, event);
    }
    
    return state;
  }
}
```

## パフォーマンス最適化

### キャッシング戦略

```typescript
export class PointsCacheService {
  private cache = new Map<string, PointsState>();
  private readonly TTL = 30 * 1000; // 30秒
  
  async getPointsState(gameId: string): Promise<PointsState> {
    const cached = this.cache.get(gameId);
    if (cached && this.isCacheValid(cached)) {
      return cached;
    }
    
    const fresh = await this.pointsService.getPointsState(gameId);
    this.cache.set(gameId, fresh);
    
    return fresh;
  }
  
  invalidateCache(gameId: string): void {
    this.cache.delete(gameId);
  }
}
```

### バッチ処理

```typescript
export class PointsBatchProcessor {
  private pendingUpdates = new Map<string, PointsCommand[]>();
  private batchTimer: NodeJS.Timeout | null = null;
  
  addCommand(command: PointsCommand): void {
    const gameId = command.gameId;
    const commands = this.pendingUpdates.get(gameId) || [];
    commands.push(command);
    this.pendingUpdates.set(gameId, commands);
    
    this.scheduleBatchProcess();
  }
  
  private scheduleBatchProcess(): void {
    if (this.batchTimer) return;
    
    this.batchTimer = setTimeout(async () => {
      await this.processBatch();
      this.batchTimer = null;
    }, 100); // 100ms後にバッチ処理
  }
  
  private async processBatch(): Promise<void> {
    for (const [gameId, commands] of this.pendingUpdates) {
      await this.processGameCommands(gameId, commands);
    }
    this.pendingUpdates.clear();
  }
}
```
