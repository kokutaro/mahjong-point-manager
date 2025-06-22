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

### インフラ

- **Vercel** (デプロイ・ホスティング)
- **Vercel Postgres** (データベース)

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
├── app/                          # Next.js App Router
│   ├── (routes)/                 # ルートグループ
│   │   ├── room/                 # ルーム関連ページ
│   │   │   ├── [roomCode]/       # 対局ページ
│   │   │   └── create/           # ルーム作成ページ
│   │   └── result/               # 結果ページ
│   ├── api/                      # API Routes
│   │   ├── games/                # ゲーム関連API
│   │   ├── socket/               # Socket.io Handler
│   │   └── players/              # プレイヤー関連API
│   ├── components/               # 共通コンポーネント
│   │   ├── ui/                   # UIコンポーネント
│   │   ├── game/                 # ゲーム固有コンポーネント
│   │   └── forms/                # フォームコンポーネント
│   ├── globals.css               # グローバルCSS
│   ├── layout.tsx                # ルートレイアウト
│   └── page.tsx                  # ホームページ
├── lib/                          # ユーティリティ・設定
│   ├── prisma.ts                 # Prisma クライアント
│   ├── socket.ts                 # Socket.io 設定
│   ├── score-calculator.ts       # 点数計算ロジック
│   └── game-logic.ts             # ゲームロジック
├── stores/                       # Zustand stores
│   ├── game-store.ts             # ゲーム状態管理
│   ├── player-store.ts           # プレイヤー状態管理
│   └── ui-store.ts               # UI状態管理
├── types/                        # TypeScript型定義
│   ├── game.ts                   # ゲーム関連型
│   ├── player.ts                 # プレイヤー関連型
│   └── api.ts                    # API関連型
├── hooks/                        # カスタムフック
│   ├── use-socket.ts             # WebSocket フック
│   ├── use-game.ts               # ゲームロジックフック
│   └── use-score.ts              # 点数計算フック
├── services/                     # ビジネスロジック
│   ├── game-service.ts           # ゲーム操作サービス
│   ├── score-service.ts          # 点数計算サービス
│   └── socket-service.ts         # WebSocket サービス
├── prisma/                       # Prisma設定
│   ├── schema.prisma             # データベーススキーマ
│   └── migrations/               # マイグレーションファイル
└── docs/                         # ドキュメント
    ├── architecture.md           # このファイル
    └── api.md                    # API仕様
```

## 状態管理アーキテクチャ (Zustand)

### Game Store

```typescript
interface GameStore {
  // 現在のゲーム状態
  currentGame: Game | null;
  participants: GameParticipant[];
  gameEvents: GameEvent[];
  
  // アクション
  setGame: (game: Game) => void;
  updateParticipant: (participantId: string, updates: Partial<GameParticipant>) => void;
  addGameEvent: (event: GameEvent) => void;
  
  // 計算系
  calculateScore: (han: number, fu: number, isOya: boolean) => ScoreResult;
  updatePoints: (event: GameEvent) => void;
}
```

### Player Store

```typescript
interface PlayerStore {
  currentPlayer: Player | null;
  setPlayer: (player: Player) => void;
  updatePlayer: (updates: Partial<Player>) => void;
}
```

### UI Store

```typescript
interface UIStore {
  // モーダル・ダイアログ状態
  scoreModalOpen: boolean;
  reachModalOpen: boolean;
  
  // 選択状態
  selectedHan: number;
  selectedFu: number;
  
  // アクション
  openScoreModal: () => void;
  closeScoreModal: () => void;
  setScore: (han: number, fu: number) => void;
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

## デプロイ・運用

### Vercel設定

- **Environment Variables** で機密情報管理
- **Preview Deployments** で機能確認
- **Analytics** でパフォーマンス監視

### 監視・ログ

- **Vercel Analytics** でアクセス解析
- **Error Tracking** でエラー監視
- **Database Monitoring** でクエリ最適化

## 拡張性考慮

### 将来対応予定機能

- **プレイヤーレーティング** システム
- **対局履歴・統計** 機能
- **カスタムルール** 設定
- **観戦機能** (WebSocket Room拡張)
- **モバイルアプリ** (React Native)

### スケールアウト

- **WebSocket** のスケール対応 (Redis Adapter)
- **データベース** 分散・レプリケーション
- **CDN** で静的リソース配信最適化
