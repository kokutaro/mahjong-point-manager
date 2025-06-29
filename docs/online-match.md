# オンライン対戦機能 詳細設計

## 概要

4人同時参加のリアルタイム麻雀対戦機能です。WebSocket通信によるルーム管理、プレイヤー認証、接続状態監視を実現します。

## 機能要件

### ルーム管理

- **ルーム作成**: 6桁のルームコードで簡単参加
- **参加管理**: 最大4人の同時参加制御
- **座席管理**: 東南西北の座席割り当て
- **席順設定**: 参加者が揃ったらドラッグ&ドロップで席を調整。ドラッグハンドルアイコンとアニメーションで操作をわかりやすく表示
- **状態同期**: 全参加者の状態をリアルタイム同期

### 接続管理

- **自動再接続**: 通信断時の自動復旧
- **ハートビート**: 接続状態の定期監視
- **タイムアウト処理**: 長時間無応答時の処理
- **グレースフル切断**: 正常終了時の適切な通知

### セッション管理

- **プレイヤー識別**: 一意ID による識別
- **セッション永続化**: ブラウザ再起動時の復帰
- **重複接続防止**: 同一プレイヤーの多重接続制御
- **権限管理**: ルーム作成者権限

## データ構造

### ルーム状態

```typescript
interface RoomState {
  roomCode: string
  gameId: string
  status: "WAITING" | "STARTING" | "PLAYING" | "FINISHED"
  createdAt: Date
  createdBy: string

  participants: RoomParticipant[]
  settings: GameSettings

  // メタ情報
  lastActivity: Date
  connectionCount: number
}

interface RoomParticipant {
  playerId: string
  playerName: string
  position?: number // 座席位置 (0-3)
  isConnected: boolean
  joinedAt: Date
  lastSeen: Date
  isHost: boolean // ルーム作成者
}
```

### 接続セッション

```typescript
interface ConnectionSession {
  socketId: string
  playerId: string
  roomCode?: string
  connectedAt: Date
  lastHeartbeat: Date
  userAgent: string
  ipAddress: string
}
```

## コア実装

### SocketService (サーバー側)

```typescript
export class SocketService {
  private io: Server
  private roomManager: RoomManager
  private sessionManager: SessionManager

  initializeSocket(server: http.Server) {
    this.io = new Server(server, {
      cors: { origin: "*" },
      transports: ["websocket", "polling"],
    })

    this.io.use(this.authMiddleware.bind(this))
    this.io.on("connection", this.handleConnection.bind(this))
  }

  private async handleConnection(socket: Socket) {
    const session = await this.sessionManager.createSession(socket)

    socket.on("join-room", (data) => this.handleJoinRoom(socket, data))
    socket.on("leave-room", () => this.handleLeaveRoom(socket))
    socket.on("game-action", (data) => this.handleGameAction(socket, data))
    socket.on("heartbeat", () => this.handleHeartbeat(socket))
    socket.on("disconnect", () => this.handleDisconnect(socket))
  }

  private async handleJoinRoom(socket: Socket, data: JoinRoomData) {
    try {
      const room = await this.roomManager.joinRoom(data.roomCode, data.playerId)

      socket.join(data.roomCode)
      socket.roomCode = data.roomCode

      // 参加成功を通知
      socket.emit("room-joined", {
        room,
        yourPosition: room.participants.find(
          (p) => p.playerId === data.playerId
        )?.position,
      })

      // 他の参加者に通知
      socket.to(data.roomCode).emit("room-updated", { room })
    } catch (error) {
      socket.emit("join-error", {
        code: error.code,
        message: error.message,
      })
    }
  }
}
```

### RoomManager

```typescript
export class RoomManager {
  private rooms = new Map<string, RoomState>()

  async createRoom(
    creatorId: string,
    settings: GameSettings
  ): Promise<RoomState> {
    const roomCode = this.generateRoomCode()
    const game = await this.gameService.createGame(settings, creatorId)

    const room: RoomState = {
      roomCode,
      gameId: game.id,
      status: "WAITING",
      createdAt: new Date(),
      createdBy: creatorId,
      participants: [
        {
          playerId: creatorId,
          playerName: await this.getPlayerName(creatorId),
          isConnected: true,
          joinedAt: new Date(),
          lastSeen: new Date(),
          isHost: true,
        },
      ],
      settings,
      lastActivity: new Date(),
      connectionCount: 1,
    }

    this.rooms.set(roomCode, room)
    return room
  }

  async joinRoom(roomCode: string, playerId: string): Promise<RoomState> {
    const room = this.rooms.get(roomCode)
    if (!room) {
      throw new RoomNotFoundError(roomCode)
    }

    if (room.participants.length >= 4) {
      throw new RoomFullError(roomCode)
    }

    // 既存参加者の再接続チェック
    const existingParticipant = room.participants.find(
      (p) => p.playerId === playerId
    )
    if (existingParticipant) {
      existingParticipant.isConnected = true
      existingParticipant.lastSeen = new Date()
    } else {
      // 新規参加
      room.participants.push({
        playerId,
        playerName: await this.getPlayerName(playerId),
        position: this.assignPosition(room),
        isConnected: true,
        joinedAt: new Date(),
        lastSeen: new Date(),
        isHost: false,
      })
    }

    room.lastActivity = new Date()
    return room
  }
}
```

### フロントエンド接続管理

```typescript
export class SocketClient {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5

  connect(playerId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io("/api/socket", {
        auth: { playerId },
        autoConnect: false,
      })

      this.socket.on("connect", () => {
        this.reconnectAttempts = 0
        this.startHeartbeat()
        resolve()
      })

      this.socket.on("disconnect", this.handleDisconnect.bind(this))
      this.socket.on("connect_error", this.handleConnectError.bind(this))

      this.socket.connect()
    })
  }

  private handleDisconnect(reason: string) {
    if (reason === "io server disconnect") {
      // サーバー側からの切断 - 再接続不要
      return
    }

    // 自動再接続
    this.attemptReconnect()
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit("max-reconnect-attempts")
      return
    }

    setTimeout(
      () => {
        this.reconnectAttempts++
        this.socket?.connect()
      },
      Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
    )
  }
}
```

## イベントフロー

### ルーム参加フロー

```
1. クライアント: join-room イベント送信
2. サーバー: ルーム存在確認 & 参加可能性チェック
3. サーバー: 参加者をルームに追加
4. サーバー: 参加者に room-joined 送信
5. サーバー: 他参加者に room-updated 送信
6. クライアント: ルーム状態を更新し UI 描画
```

### ゲームアクション同期フロー

```
1. プレイヤー: アクション実行 (ツモ・ロン等)
2. クライアント: game-action イベント送信
3. サーバー: アクション検証 & ゲーム状態更新
4. サーバー: 全参加者に game-event 配信
5. クライアント: ゲーム状態同期 & UI更新
```

## エラーハンドリング

### 接続エラー

- **RoomNotFoundError**: 存在しないルームコード
- **RoomFullError**: 満員のルーム
- **DuplicateConnectionError**: 重複接続
- **AuthenticationError**: 認証失敗

### 復旧戦略

- **自動再接続**: 指数バックオフによるリトライ
- **状態復旧**: 再接続時の状態同期
- **タイムアウト処理**: 応答なし参加者の処理

## セキュリティ

### 認証・認可

```typescript
async authMiddleware(socket: Socket, next: Function) {
  const { playerId } = socket.handshake.auth;

  if (!playerId || !await this.validatePlayer(playerId)) {
    return next(new Error('Authentication failed'));
  }

  socket.playerId = playerId;
  next();
}
```

### レート制限

- **接続制限**: 同一IPから10接続/分
- **メッセージ制限**: 30メッセージ/分/接続
- **ルーム作成**: 5ルーム/時/プレイヤー

### 不正防止

- **アクション検証**: 自分の番でのみ操作許可
- **状態整合性**: サーバー側での厳密な状態管理
- **ログ記録**: 不審な操作の追跡

## パフォーマンス最適化

### 接続管理

- **コネクションプール**: 効率的な接続管理
- **ルーム分離**: 無関係なイベント配信防止
- **バッチ送信**: 複数更新の一括配信

### メモリ管理

- **ルーム自動削除**: 非アクティブルームの自動削除
- **セッションクリーンアップ**: 切断セッションの定期削除
- **イベント履歴制限**: 古いイベントの自動削除

## 監視・運用

### ヘルスチェック

- **接続数監視**: アクティブ接続数の追跡
- **ルーム数監視**: 同時ルーム数の監視
- **エラー率監視**: 接続エラー率の監視

### ログ出力

- **接続ログ**: 接続・切断・再接続の記録
- **ルームログ**: ルーム作成・参加・終了の記録
- **エラーログ**: 全エラーの詳細記録

### アラート設定

- **高負荷警告**: 接続数・CPU使用率の閾値
- **エラー急増**: エラー率の異常値検知
- **ルーム滞留**: 長時間WAITING状態のルーム
