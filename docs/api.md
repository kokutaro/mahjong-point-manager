# API設計仕様

## 概要

麻雀点数管理アプリのAPI設計です。REST APIとWebSocket通信を組み合わせてリアルタイム対戦を実現します。

## 技術仕様

- **REST API**: Next.js API Routes
- **WebSocket**: Socket.io
- **認証**: セッションベース認証
- **データ形式**: JSON
- **エラーハンドリング**: 統一されたエラーレスポンス

## REST API エンドポイント

### プレイヤー管理

#### プレイヤー作成

```http
POST /api/players
Content-Type: application/json

{
  "name": "プレイヤー名",
  "avatar": "アバター画像URL (オプション)"
}
```

**レスポンス (201 Created)**

```json
{
  "success": true,
  "data": {
    "id": "clxxx...",
    "name": "プレイヤー名",
    "avatar": "アバター画像URL",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### プレイヤー情報取得

```http
GET /api/players/{playerId}
```

**レスポンス (200 OK)**

```json
{
  "success": true,
  "data": {
    "id": "clxxx...",
    "name": "プレイヤー名",
    "avatar": "アバター画像URL",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### ゲーム管理

#### ゲーム作成

```http
POST /api/games
Content-Type: application/json

{
  "gameType": "TONPUU" | "HANCHAN",
  "settings": {
    "startingPoints": 25000,
    "umaSettings": {
      "first": 20000,
      "second": 10000,
      "third": -10000,
      "fourth": -20000
    },
    "hasOka": true,
    "hasTobi": true,
    "hasYakitori": true,
    "tobiPenalty": 20000,
    "yakitoriPenalty": 20000
  },
  "creatorId": "プレイヤーID"
}
```

**レスポンス (201 Created)**

```json
{
  "success": true,
  "data": {
    "id": "clxxx...",
    "roomCode": "1234",
    "gameType": "TONPUU",
    "status": "WAITING",
    "currentRound": 1,
    "honba": 0,
    "kyotaku": 0,
    "startingOya": 0,
    "currentOya": 0,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "settings": { ... }
  }
}
```

#### ゲーム参加

```http
POST /api/games/{gameId}/join
Content-Type: application/json

{
  "playerId": "プレイヤーID",
  "position": 0
}
```

**レスポンス (200 OK)**

```json
{
  "success": true,
  "data": {
    "id": "参加者ID",
    "gameId": "ゲームID",
    "playerId": "プレイヤーID",
    "position": 0,
    "currentPoints": 25000,
    "isReach": false
  }
}
```

#### ゲーム状態取得

```http
GET /api/games/{gameId}
```

**レスポンス (200 OK)**

```json
{
  "success": true,
  "data": {
    "game": {
      "id": "clxxx...",
      "roomCode": "1234",
      "gameType": "TONPUU",
      "status": "PLAYING",
      "currentRound": 3,
      "honba": 1,
      "kyotaku": 2,
      "currentOya": 1
    },
    "participants": [
      {
        "id": "participant1",
        "playerId": "player1",
        "position": 0,
        "currentPoints": 26000,
        "isReach": false,
        "player": {
          "name": "プレイヤー1",
          "avatar": "avatar1.jpg"
        }
      }
    ],
    "events": [
      {
        "id": "event1",
        "eventType": "TSUMO",
        "round": 2,
        "honba": 0,
        "eventData": { ... },
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

#### ルームコードでゲーム検索

```http
GET /api/games/room/{roomCode}
```

### ゲームイベント

#### イベント作成

```http
POST /api/games/{gameId}/events
Content-Type: application/json

{
  "playerId": "プレイヤーID (オプション)",
  "eventType": "TSUMO" | "RON" | "REACH" | "RYUKYOKU",
  "eventData": {
    // ツモ・ロンの場合
    "han": 3,
    "fu": 30,
    "targetPlayerId": "ロン対象プレイヤーID (ロンの場合)",
    "pointsChange": [
      { "playerId": "player1", "change": -3000 },
      { "playerId": "player2", "change": 1000 },
      { "playerId": "player3", "change": 1000 },
      { "playerId": "player4", "change": 1000 }
    ]
  }
}
```

**レスポンス (201 Created)**

```json
{
  "success": true,
  "data": {
    "id": "event_id",
    "gameId": "game_id",
    "playerId": "player_id",
    "eventType": "TSUMO",
    "round": 3,
    "honba": 1,
    "eventData": { ... },
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 点数計算

#### 点数計算API

```http
POST /api/score/calculate
Content-Type: application/json

{
  "han": 3,
  "fu": 30,
  "isOya": true,
  "isTsumo": true,
  "honba": 1,
  "kyotaku": 2
}
```

**レスポンス (200 OK)**

```json
{
  "success": true,
  "data": {
    "basePoints": 3900,
    "oyaPoints": 3900,
    "koPoints": 0,
    "tsumoDistribution": {
      "oyaReceives": 4200,
      "koReceives": 0,
      "koPays": 1400
    },
    "ronDistribution": null,
    "withHonbaKyotaku": {
      "totalReceives": 4800,
      "honbaBonus": 300,
      "kyotakuBonus": 300
    }
  }
}
```

#### 点数マスタ取得

```http
GET /api/score/patterns
```

**レスポンス (200 OK)**

```json
{
  "success": true,
  "data": [
    {
      "han": 1,
      "fu": 30,
      "oyaPoints": 1500,
      "koPoints": 1000,
      "oyaTsumoAll": 500,
      "koTsumoOya": 1000,
      "koTsumoKo": 500
    }
  ]
}
```

## WebSocket通信

### 接続・認証

#### 接続

```javascript
// クライアント側
const socket = io('/api/socket', {
  auth: {
    playerId: 'player_id',
    gameId: 'game_id'
  }
});
```

#### サーバー側認証

```javascript
// サーバー側でプレイヤー・ゲーム検証
io.use((socket, next) => {
  const { playerId, gameId } = socket.handshake.auth;
  // 認証ロジック
  if (valid) {
    socket.playerId = playerId;
    socket.gameId = gameId;
    next();
  } else {
    next(new Error('Authentication failed'));
  }
});
```

### ルーム管理

#### ルーム参加

```javascript
// Client → Server
socket.emit('join-room', {
  roomCode: '1234',
  playerId: 'player_id'
});

// Server → Client (成功)
socket.emit('room-joined', {
  game: { ... },
  participants: [ ... ],
  position: 0
});

// Server → Client (エラー)
socket.emit('join-error', {
  code: 'ROOM_FULL',
  message: 'ルームが満員です'
});
```

#### ルーム状態更新

```javascript
// Server → All Clients in Room
io.to(roomCode).emit('room-updated', {
  game: { ... },
  participants: [ ... ]
});
```

### ゲームアクション

#### ツモ

```javascript
// Client → Server
socket.emit('game-action', {
  type: 'TSUMO',
  data: {
    han: 3,
    fu: 30
  }
});

// Server → All Clients
io.to(roomCode).emit('game-event', {
  type: 'TSUMO',
  playerId: 'player_id',
  round: 3,
  honba: 1,
  data: {
    han: 3,
    fu: 30,
    pointsChange: [ ... ]
  }
});
```

#### ロン

```javascript
// Client → Server
socket.emit('game-action', {
  type: 'RON',
  data: {
    han: 2,
    fu: 30,
    targetPlayerId: 'target_player_id'
  }
});
```

#### リーチ

```javascript
// Client → Server
socket.emit('game-action', {
  type: 'REACH',
  data: {}
});

// Server → All Clients
io.to(roomCode).emit('game-event', {
  type: 'REACH',
  playerId: 'player_id',
  round: 3,
  honba: 1
});
```

#### 流局

```javascript
// Client → Server
socket.emit('game-action', {
  type: 'RYUKYOKU',
  data: {
    reason: 'NINE_TERMINALS' | 'FOUR_WINDS' | 'DRAW'
  }
});
```

### 点数更新

#### リアルタイム点数同期

```javascript
// Server → All Clients
io.to(roomCode).emit('points-updated', {
  participants: [
    {
      playerId: 'player1',
      currentPoints: 26000,
      isReach: false
    }
  ]
});
```

#### 親・本場更新

```javascript
// Server → All Clients
io.to(roomCode).emit('round-updated', {
  currentRound: 4,
  currentOya: 1,
  honba: 2,
  kyotaku: 1
});
```

### ゲーム終了

#### 対局終了通知

```javascript
// Server → All Clients
io.to(roomCode).emit('game-finished', {
  result: {
    rankings: [
      {
        playerId: 'player1',
        finalPoints: 35000,
        rank: 1,
        uma: 20000,
        oka: 10000,
        settlement: 30000
      }
    ]
  }
});
```

### エラーハンドリング

#### 一般的なエラー

```javascript
// Server → Client
socket.emit('error', {
  code: 'INVALID_ACTION',
  message: '無効なアクションです',
  details: {
    action: 'TSUMO',
    reason: 'NOT_YOUR_TURN'
  }
});
```

#### エラーコード一覧

- `ROOM_NOT_FOUND`: ルームが見つかりません
- `ROOM_FULL`: ルームが満員です
- `GAME_NOT_ACTIVE`: ゲームが開始されていません
- `INVALID_ACTION`: 無効なアクションです
- `NOT_YOUR_TURN`: あなたの番ではありません
- `INVALID_SCORE`: 無効な点数です
- `PERMISSION_DENIED`: 権限がありません

## 共通レスポンス形式

### 成功レスポンス

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### エラーレスポンス

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "エラーメッセージ",
    "details": { ... }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## HTTP ステータスコード

- `200 OK`: 成功
- `201 Created`: 作成成功
- `400 Bad Request`: リクエストエラー
- `401 Unauthorized`: 認証エラー
- `403 Forbidden`: 権限エラー
- `404 Not Found`: リソースが見つからない
- `409 Conflict`: 競合エラー
- `500 Internal Server Error`: サーバーエラー

## レート制限

### WebSocket

- **接続**: 同一IPから10接続/分
- **メッセージ**: 30メッセージ/分/接続

### REST API

- **一般**: 100リクエスト/分/IP
- **作成系**: 10リクエスト/分/IP

## セキュリティ

### 入力検証

- **翻数**: 1-13
- **符数**: 20,25,30,40,50,60,70,80,90,100,110
- **プレイヤー名**: 1-20文字
- **ルームコード**: 4桁数字

### 権限チェック

- **ゲームアクション**: 参加者のみ
- **点数更新**: 該当プレイヤーのみ
- **ルーム作成**: 認証済みユーザーのみ

### データ暗号化

- **WebSocket**: WSS (HTTPS環境)
- **API**: HTTPS強制
- **セッション**: HttpOnly Cookie
