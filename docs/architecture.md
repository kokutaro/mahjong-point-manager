# アーキテクチャ設計

## 技術スタック

### フロントエンド

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS** (UI/スタイリング)
- **Zustand** (状態管理)
- **React Hook Form** (フォーム管理)
- **Socket.io Client** (リアルタイム通信)

### バックエンド

- **Next.js API Routes**
- **Prisma** (ORM)
- **PostgreSQL** (データベース)
- **Socket.io** (リアルタイム通信)

### インフラ・開発環境

- **Docker** (開発環境・本番デプロイ)
- **PostgreSQL** (データベース)
- **Jest + Testing Library** (テスト環境)

## システム構成

```text
┌─────────────────────────────────────────────────────────────┐
│                    Client (Browser)                         │
├─────────────────────────────────────────────────────────────┤
│  Next.js App Router + React Components                      │
│  ├─ Zustand Store (Game State)                              │
│  ├─ Socket.io Client (Realtime)                             │
│  └─ React Hook Form (Forms)                                 │
├─────────────────────────────────────────────────────────────┤
│                    Vercel Edge Network                      │
├─────────────────────────────────────────────────────────────┤
│  Next.js Server (API Routes + Socket.io)                    │
│  ├─ REST API Endpoints                                      │
│  ├─ WebSocket Handlers                                      │
│  └─ Business Logic Services                                 │
├─────────────────────────────────────────────────────────────┤
│  Prisma ORM                                                 │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL Database                                        │
└─────────────────────────────────────────────────────────────┘
```

## ディレクトリ構成

```text
mahjong-point-manager/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── api/                  # API Routes
│   │   │   ├── auth/             # 認証関連API
│   │   │   ├── game/             # ゲーム操作API
│   │   │   │   └── [gameId]/     # 個別ゲーム操作
│   │   │   ├── room/             # ルーム管理API
│   │   │   ├── score/            # 点数計算API
│   │   │   ├── history/          # 履歴API
│   │   │   └── stats/            # 統計API
│   │   ├── game/                 # ゲーム画面
│   │   │   └── [gameId]/         # 対局ページ
│   │   ├── room/                 # ルーム管理
│   │   │   ├── create/           # ルーム作成
│   │   │   └── [roomCode]/       # ルーム参加・待機
│   │   ├── history/              # 履歴・統計ページ
│   │   ├── layout.tsx            # ルートレイアウト
│   │   └── page.tsx              # ホームページ
│   ├── components/               # React コンポーネント
│   │   ├── ui/                   # 基本UIコンポーネント
│   │   ├── game/                 # ゲーム固有コンポーネント
│   │   └── forms/                # フォームコンポーネント
│   ├── hooks/                    # カスタムフック
│   │   ├── useSocket.ts          # WebSocket フック
│   │   └── usePerformanceMonitor.ts # パフォーマンス監視
│   ├── lib/                      # ユーティリティ・ロジック
│   │   ├── prisma.ts             # Prisma クライアント
│   │   ├── socket.ts             # Socket.io サーバー設定
│   │   ├── socket-client.ts      # Socket.io クライアント
│   │   ├── score.ts              # 点数計算ロジック
│   │   ├── point-manager.ts      # 点数管理クラス
│   │   ├── auth.ts               # 認証ロジック
│   │   └── utils.ts              # ユーティリティ関数
│   ├── types/                    # TypeScript型定義
│   │   └── game.ts               # ゲーム関連型定義
│   └── __tests__/                # テストファイル
│       ├── lib/                  # ライブラリテスト
│       ├── components/           # コンポーネントテスト
│       └── api/                  # APIテスト
├── prisma/                       # Prisma設定
│   ├── schema.prisma             # データベーススキーマ
│   ├── seed.ts                   # シードデータ
│   └── migrations/               # マイグレーションファイル
├── docs/                         # ドキュメント
│   ├── architecture.md           # このファイル
│   ├── api.md                    # API仕様
│   ├── score-calculation.md      # 点数計算仕様
│   ├── point-management.md       # 点数管理仕様
│   ├── game-settlement.md        # 精算システム仕様
│   ├── round-management.md       # 局管理仕様
│   ├── reach-kyotaku.md          # リーチ・供託仕様
│   ├── online-match.md           # オンライン対戦仕様
│   └── ui-ux-design.md           # UI/UX設計
├── jest.config.js                # Jest設定
├── jest.setup.js                 # Jestセットアップ
├── docker-compose.yml            # Docker設定
└── server.js                     # Socket.io サーバー
```

## 状態管理アーキテクチャ (Zustand)

### Game Store (実装済み)

```typescript
interface GameStore {
  // 現在のゲーム状態
  gameState: GameState | null;
  currentPlayer: PlayerState | null;
  
  // アクション
  setGameState: (state: GameState) => void;
  setCurrentPlayer: (player: PlayerState) => void;
  updatePlayer: (playerId: string, updates: Partial<PlayerState>) => void;
  
  // ゲーム操作
  handleScoreSubmit: (scoreData: ScoreSubmission) => void;
  handleReachDeclaration: (playerId: string) => void;
  handleRyukyoku: (tenpaiPlayers: string[]) => void;
}
```

### PointManager クラス (実装済み)

```typescript
class PointManager {
  private gameId: string;
  
  // 点数分配
  async distributeWinPoints(winnerId: string, scoreResult: ScoreCalculationResult, isTsumo: boolean, loserId?: string): Promise<{gameEnded: boolean}>;
  
  // リーチ処理
  async declareReach(playerId: string): Promise<void>;
  
  // 流局処理
  async handleRyukyoku(reason: string, tenpaiPlayers: string[]): Promise<{gameEnded: boolean}>;
  
  // 精算計算
  private calculateSettlement(participants: GameParticipant[], settings: GameSettings): SettlementResult[];
  
  // ゲーム終了判定
  async checkGameEnd(): Promise<{shouldEnd: boolean; reason?: string}>;
}
```

## リアルタイム通信アーキテクチャ

### WebSocket Events

#### Client → Server

```typescript
// ルーム参加
socket.emit('join-room', { roomCode: string, player: Player });

// ゲームアクション
socket.emit('game-action', {
  type: 'TSUMO' | 'RON' | 'REACH' | 'RYUKYOKU',
  data: GameEventData
});

// 点数更新
socket.emit('update-score', { eventId: string, scoreData: ScoreData });
```

#### Server → Client

```typescript
// ルーム状態更新
socket.emit('room-updated', { game: Game, participants: GameParticipant[] });

// ゲームイベント通知
socket.emit('game-event', { event: GameEvent });

// 点数変動通知
socket.emit('points-updated', { participants: GameParticipant[] });

// エラー通知
socket.emit('error', { message: string, code: string });
```

## データフロー

### ゲームアクション処理フロー

```text
1. User Action (UI) → 2. Zustand Store → 3. Socket.io Emit
                                              ↓
8. UI Update ← 7. Store Update ← 6. Socket.io Receive
                                              ↓
                  4. Server Handler → 5. Database Update
```

### 点数計算フロー

```text
1. 翻数・符数選択 → 2. ScoreCalculator → 3. 点数結果
                                            ↓
6. DB保存 ← 5. GameEvent作成 ← 4. 点数分配計算
                                            ↓
7. WebSocket通知 → 8. 全クライアント更新
```

## コンポーネント設計

### ページコンポーネント

- `app/page.tsx` - ホーム画面
- `app/room/create/page.tsx` - ルーム作成
- `app/room/[roomCode]/page.tsx` - 対局画面
- `app/result/[gameId]/page.tsx` - 結果画面

### ゲームコンポーネント

- `GameBoard` - メインゲーム画面
- `PlayerPanel` - プレイヤー情報表示
- `ScoreDisplay` - 点数表示
- `ActionButtons` - ツモ・ロンボタン
- `ScoreModal` - 点数入力モーダル

### UIコンポーネント

- `Button` - 汎用ボタン
- `Modal` - モーダルダイアログ
- `Card` - カードレイアウト
- `Loading` - ローディング表示

## パフォーマンス最適化

### フロントエンド

- **React.memo** でコンポーネント再レンダリング最適化
- **useMemo/useCallback** で重い計算・関数をメモ化
- **Zustand** の部分購読で不要な再レンダリング防止
- **Next.js Image** で画像最適化

### バックエンド

- **Prisma Connection Pooling** でDB接続最適化
- **Redis** (将来) でセッション・キャッシュ管理
- **WebSocket Room** で効率的な通信

### データベース

- **インデックス** 最適化
- **N+1問題** 対策 (Prisma include)
- **トランザクション** で整合性確保

## セキュリティ考慮事項

### 認証・認可

- **セッション管理** でプレイヤー識別
- **ルームコード検証** で不正アクセス防止
- **WebSocket認証** で通信セキュリティ

### データ検証

- **入力値検証** (Zod等)
- **権限チェック** (自分のアクションのみ許可)
- **レート制限** (DoS攻撃対策)

## テスト戦略

### テスト構成 (実装済み)

- **Unit Tests**: 30テスト (全パス)
  - 点数計算ロジック (`score.ts`)
  - 点数管理クラス (`point-manager.ts`)
  - ユーティリティ関数 (`utils.ts`)
- **Integration Tests**: API エンドポイント
- **Component Tests**: React コンポーネント

### テストツール

- **Jest** - テストフレームワーク
- **Testing Library** - React コンポーネントテスト
- **TypeScript** - 型安全性テスト

### テストコマンド

```bash
npm test              # テスト実行
npm run test:watch    # ウォッチモード
npm run test:coverage # カバレッジ測定
```

## デプロイ・運用

### Docker 構成

- **開発環境**: Docker Compose
- **本番環境**: Docker コンテナ
- **データベース**: PostgreSQL コンテナ

### 環境設定

- **Environment Variables** で機密情報管理
- **Database URL** で接続設定
- **Socket.IO** ポート設定

## 拡張性考慮

### 実装済み機能

- ✅ **対局履歴・統計** 機能 
- ✅ **CSVエクスポート** 機能
- ✅ **レスポンシブデザイン** 対応

### 将来対応予定機能

- **プレイヤーレーティング** システム
- **カスタムルール** 設定
- **観戦機能** (WebSocket Room拡張)
- **モバイルアプリ** (React Native)
- **焼き鳥ルール** 対応

### スケールアウト

- **WebSocket** のスケール対応 (Redis Adapter)
- **データベース** 分散・レプリケーション
- **CDN** で静的リソース配信最適化
