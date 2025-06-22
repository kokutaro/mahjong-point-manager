import { io, Socket } from 'socket.io-client'

export class SocketClient {
  private socket: Socket | null = null
  private static instance: SocketClient | null = null

  private constructor() {}

  static getInstance(): SocketClient {
    if (!SocketClient.instance) {
      SocketClient.instance = new SocketClient()
    }
    return SocketClient.instance
  }

  connect(url?: string): Socket {
    if (this.socket?.connected) {
      return this.socket
    }

    let socketUrl = url
    
    if (!socketUrl && typeof window !== 'undefined') {
      // 現在のページのURLベースでWebSocket URLを生成
      if (process.env.NODE_ENV === 'production') {
        // プロダクション環境：現在のホスト名とプロトコルを使用（ポートなし）
        socketUrl = `${window.location.protocol}//${window.location.host}`
      } else {
        // 開発環境：ポート3000を指定
        const port = window.location.port || '3000'
        socketUrl = `${window.location.protocol}//${window.location.hostname}:${port}`
      }
    }
    
    // フォールバック（通常使用されない）
    if (!socketUrl) {
      socketUrl = process.env.NODE_ENV === 'production' 
        ? `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost'}` 
        : 'http://localhost:3000'
    }
    
    console.log('Connecting to WebSocket:', socketUrl, 'NODE_ENV:', process.env.NODE_ENV)
    
    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      forceNew: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      autoConnect: true,
      upgrade: true,
      rememberUpgrade: true
    })

    this.socket.on('connect', () => {
      console.log('WebSocket connected:', this.socket?.id)
    })

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason)
    })

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error)
    })

    return this.socket
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  getSocket(): Socket | null {
    return this.socket
  }

  // ルーム参加
  joinRoom(roomCode: string, playerId: string) {
    console.log('🏠 Emitting join_room:', { roomCode, playerId, socketId: this.socket?.id })
    this.socket?.emit('join_room', { roomCode, playerId })
  }

  // プレイヤー準備完了
  setReady(gameId: string, playerId: string) {
    this.socket?.emit('player_ready', { gameId, playerId })
  }

  // 点数計算
  calculateScore(data: {
    gameId: string
    winnerId: string
    han: number
    fu: number
    isTsumo: boolean
    loserId?: string
  }) {
    this.socket?.emit('calculate_score', data)
  }

  // リーチ宣言
  declareReach(gameId: string, playerId: string) {
    this.socket?.emit('declare_reach', { gameId, playerId })
  }

  // 流局
  declareRyukyoku(gameId: string, reason: string, tenpaiPlayers: string[] = []) {
    this.socket?.emit('ryukyoku', { gameId, reason, tenpaiPlayers })
  }

  // イベントリスナー登録
  onGameState(callback: (gameState: any) => void) {
    this.socket?.on('game_state', callback)
  }

  onPlayerJoined(callback: (data: any) => void) {
    this.socket?.on('player_joined', callback)
  }

  onPlayerConnected(callback: (data: any) => void) {
    this.socket?.on('player_connected', callback)
  }

  onGameStart(callback: (gameState: any) => void) {
    this.socket?.on('game_start', callback)
    this.socket?.on('game_started', callback)
  }

  onScoreUpdated(callback: (data: any) => void) {
    this.socket?.on('score_updated', callback)
  }

  onRiichiDeclared(callback: (data: any) => void) {
    this.socket?.on('riichi_declared', callback)
  }

  onRyukyoku(callback: (data: any) => void) {
    this.socket?.on('ryukyoku', callback)
  }

  onSeatOrderUpdated(callback: (data: any) => void) {
    this.socket?.on('seat_order_updated', callback)
  }

  onError(callback: (error: any) => void) {
    this.socket?.on('error', callback)
  }

  // イベントリスナー削除
  offGameState(callback?: (gameState: any) => void) {
    this.socket?.off('game_state', callback)
  }

  offPlayerJoined(callback?: (data: any) => void) {
    this.socket?.off('player_joined', callback)
  }

  offPlayerConnected(callback?: (data: any) => void) {
    this.socket?.off('player_connected', callback)
  }

  offGameStart(callback?: (gameState: any) => void) {
    this.socket?.off('game_start', callback)
    this.socket?.off('game_started', callback)
  }

  offScoreUpdated(callback?: (data: any) => void) {
    this.socket?.off('score_updated', callback)
  }

  offRiichiDeclared(callback?: (data: any) => void) {
    this.socket?.off('riichi_declared', callback)
  }

  offRyukyoku(callback?: (data: any) => void) {
    this.socket?.off('ryukyoku', callback)
  }

  offSeatOrderUpdated(callback?: (data: any) => void) {
    this.socket?.off('seat_order_updated', callback)
  }

  offError(callback?: (error: any) => void) {
    this.socket?.off('error', callback)
  }
}

// シングルトンインスタンスをエクスポート
export const socketClient = SocketClient.getInstance()