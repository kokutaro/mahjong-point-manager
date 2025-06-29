# UI/UX機能 詳細設計

## 概要

麻雀点数管理アプリのユーザーインターフェース設計です。レスポンシブ対応、直感的な操作フロー、リアルタイム表示によって優れたユーザー体験を提供します。

## 設計原則

### ユーザビリティ

- **直感的操作**: 麻雀経験者が迷わず使える UI
- **タッチフレンドリー**: スマートフォンでの快適な操作
- **視認性**: 点数・状態の一目での把握
- **エラー防止**: 誤操作を防ぐ適切なバリデーション

### レスポンシブ設計

- **モバイルファースト**: スマートフォンを基準とした設計
- **画面サイズ対応**: 320px〜1920px の幅広い対応
- **タッチ操作最適化**: 44px 以上のタッチターゲット
- **縦・横向き対応**: オリエンテーション変更への対応

## 画面設計

### ホーム画面

```text
┌─────────────────────────┐
│  麻雀点数管理アプリ        │
├─────────────────────────┤
│  [ルーム作成]             │
│                         │
│  [ルーム参加]             │
│  [コード: ____]          │
│                         │
│  最近の対局               │
│  • ルーム1234 (完了)      │
│  • ルーム5678 (進行中)    │
└─────────────────────────┘
```

### 対局画面 (メイン)

```text
┌─────────────────────────┐
│ 東2局 1本場 供託2本        │
├─────────────────────────┤
│     北 [25000]          │
│   (リーチ)              │
│                         │
│ 西[24000]    東[26000]  │
│              (親)       │
│                         │
│     南 [25000]          │
│                         │
├─────────────────────────┤
│ [ツモ] [ロン] [リーチ]   │
│ [流局] [設定]           │
└─────────────────────────┘
```

## コンポーネント設計

### レイアウトコンポーネント

```typescript
// ゲームボード全体レイアウト
const GameBoard = () => (
  <div className="min-h-screen bg-green-800">
    <GameHeader />
    <PlayerLayout />
    <ActionPanel />
    <ConnectionStatus />
  </div>
);

// プレイヤー配置 (東南西北)
const PlayerLayout = () => (
  <div className="relative h-96 w-full max-w-md mx-auto">
    <PlayerCard position="north" className="absolute top-0 left-1/2 -translate-x-1/2" />
    <PlayerCard position="east" className="absolute right-0 top-1/2 -translate-y-1/2" />
    <PlayerCard position="south" className="absolute bottom-0 left-1/2 -translate-x-1/2" />
    <PlayerCard position="west" className="absolute left-0 top-1/2 -translate-y-1/2" />
  </div>
);
```

### 操作コンポーネント

```typescript
// アクションボタン群
const ActionPanel = () => {
  const { canTsumo, canRon, canReach } = useGameActions();

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-white shadow-lg">
      <div className="grid grid-cols-3 gap-2 max-w-md mx-auto">
        <ActionButton
          variant="primary"
          disabled={!canTsumo}
          onClick={onTsumo}
        >
          ツモ
        </ActionButton>
        <ActionButton
          variant="primary"
          disabled={!canRon}
          onClick={onRon}
        >
          ロン
        </ActionButton>
        <ActionButton
          variant="secondary"
          disabled={!canReach}
          onClick={onReach}
        >
          リーチ
        </ActionButton>
      </div>
    </div>
  );
};
```

## レスポンシブ対応

### ブレークポイント

```typescript
const breakpoints = {
  sm: "640px", // スマートフォン縦
  md: "768px", // タブレット縦
  lg: "1024px", // タブレット横・小型PC
  xl: "1280px", // デスクトップ
  "2xl": "1536px", // 大型デスクトップ
}
```

### 画面サイズ別レイアウト

```css
/* モバイル (デフォルト) */
.player-layout {
  @apply grid grid-cols-1 gap-2;
}

/* タブレット */
@screen md {
  .player-layout {
    @apply grid-cols-2;
  }

  .action-panel {
    @apply grid-cols-4;
  }
}

/* デスクトップ */
@screen lg {
  .game-board {
    @apply flex flex-row;
  }

  .player-layout {
    @apply relative h-[500px] w-[500px];
  }
}
```

## 操作フロー

### ツモ・ロン フロー

```text
1. ツモ/ロンボタンタップ
   ↓
2. 点数入力モーダル表示
   ↓
3. 翻数・符数選択
   ↓
4. 点数計算プレビュー表示
   ↓
5. 確定ボタンタップ
   ↓
6. サーバーへ送信
   ↓
7. 結果反映・画面更新
```

### 点数入力 UI

```typescript
const ScoreInputModal = () => {
  const [han, setHan] = useState(1);
  const [fu, setFu] = useState(30);
  const scoreResult = useScoreCalculation(han, fu);

  return (
    <Modal>
      <div className="space-y-4">
        <HanSelector value={han} onChange={setHan} />
        <FuSelector value={fu} onChange={setFu} disabled={han >= 5} />
        <ScorePreview result={scoreResult} />
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            キャンセル
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            確定
          </Button>
        </div>
      </div>
    </Modal>
  );
};
```

## リアルタイム表示

### 状態同期

```typescript
// リアルタイム状態管理
const useRealtimeGameState = (gameId: string) => {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const socket = useSocket()

  useEffect(() => {
    socket.on("game-state-updated", setGameState)
    socket.on("points-updated", updatePoints)
    socket.on("round-updated", updateRound)

    return () => {
      socket.off("game-state-updated")
      socket.off("points-updated")
      socket.off("round-updated")
    }
  }, [socket])

  return gameState
}
```

### アニメーション

```typescript
// 点数変動アニメーション
const PointsDisplay = ({ points, previousPoints }) => {
  const difference = points - previousPoints;

  return (
    <div className="relative">
      <span className="text-2xl font-bold">
        {points.toLocaleString()}
      </span>
      {difference !== 0 && (
        <motion.span
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className={`absolute -top-6 right-0 text-sm font-medium ${
            difference > 0 ? 'text-green-500' : 'text-red-500'
          }`}
        >
          {difference > 0 ? '+' : ''}{difference}
        </motion.span>
      )}
    </div>
  );
};
```

## アクセシビリティ

### ARIA ラベル

```typescript
const ActionButton = ({ children, disabled, onClick, ariaLabel }) => (
  <button
    className="btn"
    disabled={disabled}
    onClick={onClick}
    aria-label={ariaLabel || children}
    aria-disabled={disabled}
  >
    {children}
  </button>
);
```

### キーボードナビゲーション

```typescript
const useKeyboardShortcuts = () => {
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case "t": // ツモ
          if (canTsumo) onTsumo()
          break
        case "r": // ロン
          if (canRon) onRon()
          break
        case "l": // リーチ
          if (canReach) onReach()
          break
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [canTsumo, canRon, canReach])
}
```

## エラー表示

### エラーハンドリング

```typescript
const ErrorBoundary = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-bold text-red-600">
            エラーが発生しました
          </h2>
          <p className="text-gray-600">
            {error?.message || '予期しないエラーが発生しました'}
          </p>
          <Button onClick={() => window.location.reload()}>
            再読み込み
          </Button>
        </div>
      </div>
    );
  }

  return children;
};
```

### 接続状態表示

```typescript
const ConnectionStatus = () => {
  const { isConnected, isReconnecting } = useSocket();

  if (isConnected) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-red-500 text-white p-2 text-center">
      {isReconnecting ? '再接続中...' : '接続が切断されました'}
    </div>
  );
};
```

## パフォーマンス最適化

### 仮想化・メモ化

```typescript
// 重いコンポーネントのメモ化
const PlayerCard = memo(({ player, position }: PlayerCardProps) => {
  return (
    <div className="player-card">
      <h3>{player.name}</h3>
      <PointsDisplay points={player.currentPoints} />
      {player.isReach && <ReachIndicator />}
    </div>
  );
});

// 計算結果のメモ化
const useScoreCalculation = (han: number, fu: number) => {
  return useMemo(() => {
    return calculateScore(han, fu);
  }, [han, fu]);
};
```

### 遅延読み込み

```typescript
// コンポーネントの遅延読み込み
const ScoreInputModal = lazy(() => import('./ScoreInputModal'));
const GameResultModal = lazy(() => import('./GameResultModal'));

const GameBoard = () => (
  <div>
    <Suspense fallback={<LoadingSpinner />}>
      {showScoreModal && <ScoreInputModal />}
      {showResultModal && <GameResultModal />}
    </Suspense>
  </div>
);
```

## テーマ・スタイリング

### カラーパレット

```typescript
const theme = {
  colors: {
    primary: {
      50: "#f0f9ff",
      500: "#3b82f6",
      600: "#2563eb",
      700: "#1d4ed8",
    },
    success: "#10b981",
    warning: "#f59e0b",
    error: "#ef4444",
    mahjong: {
      table: "#0f5132", // 雀卓の緑
      tiles: "#f8f9fa", // 牌の白
      reach: "#dc3545", // リーチの赤
    },
  },
}
```

### ダークモード対応

```typescript
const useDarkMode = () => {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem("dark-mode")
    setIsDark(saved === "true")
  }, [])

  const toggle = () => {
    setIsDark(!isDark)
    localStorage.setItem("dark-mode", (!isDark).toString())
  }

  return { isDark, toggle }
}
```
