# Docker WebSocket トラブルシューティングガイド

## 問題の症状

- Docker環境でWebSocketの接続ができない
- ブラウザのコンソールに接続エラーが表示される
- リアルタイム機能が動作しない

## 解決済み設定

### 1. クライアント側設定 (socket-client.ts)

```typescript
// プロダクション環境では正しいURLを生成
const socketUrl = process.env.NODE_ENV === 'production' 
  ? `${window.location.protocol}//${window.location.hostname}`  // ポート番号なし（Nginxプロキシ）
  : `${window.location.protocol}//${window.location.hostname}:${port}`
```

### 2. サーバー側設定 (server.js)

```javascript
// プロダクション環境では0.0.0.0でバインド
const hostname = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost'
```

### 3. Socket.IO設定 (socketjs.js)

```javascript
// CORS設定を適切に構成
cors: {
  origin: corsOrigins,  // 環境に応じたオリジン設定
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}
```

### 4. Nginx設定 (nginx.prod.conf)

```nginx
# WebSocket upgrade処理
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

# Socket.IO専用location
location /socket.io/ {
    proxy_pass http://nextjs_upstream;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    # 各種ヘッダー設定...
    proxy_buffering off;
    proxy_read_timeout 86400;
}
```

### 5. Docker Compose設定

```yaml
# アプリケーションコンテナ
app:
  environment:
    - NODE_ENV=production
    - WEBSOCKET_HOST=0.0.0.0
    - NEXTAUTH_URL=http://localhost  # プロキシ経由のURL
  expose:
    - "3000"  # 内部ネットワークのみ

# Nginxコンテナ
nginx:
  ports:
    - "80:80"  # 外部に公開
```

## デバッグ方法

### 1. WebSocketステータス確認

ブラウザで以下にアクセス：

```text
http://localhost/api/websocket-status
```

### 2. デバッグパネル表示

ブラウザで `Ctrl+Shift+W` を押してデバッグパネルを表示

### 3. ログ確認

```bash
# アプリケーションログ
docker logs mahjong-app-prod

# Nginxログ
docker logs mahjong-nginx-prod

# 全コンテナログ
docker-compose -f docker-compose.prod.yml logs -f
```

### 4. ネットワーク接続テスト

```bash
# コンテナ間接続確認
docker exec mahjong-nginx-prod curl http://app:3000/api/health

# WebSocket接続テスト（ブラウザコンソール）
const testSocket = io();
testSocket.on('connect', () => console.log('Connected:', testSocket.id));
```

## 起動手順

### 1. 環境変数設定

```bash
cp .env.prod.example .env.prod
# .env.prodファイルを編集して必要な値を設定
```

### 2. Docker Composeでビルド・起動

```bash
# プロダクションビルド
docker-compose -f docker-compose.prod.yml build

# 起動
docker-compose -f docker-compose.prod.yml up -d

# ログ確認
docker-compose -f docker-compose.prod.yml logs -f app
```

### 3. 動作確認

1. <http://localhost> でアプリケーションアクセス
2. WebSocketステータス確認: <http://localhost/api/websocket-status>  
3. ゲーム作成・参加でリアルタイム機能をテスト

## よくある問題と解決策

### 問題1: 「WebSocket connection failed」

**原因**: CORS設定またはプロキシ設定の問題
**解決**: NEXTAUTH_URLとNginxのproxy_set_headerを確認

### 問題2: 「Socket.IO not found」  

**原因**: server.jsまたはsocketjs.jsがコンテナにコピーされていない
**解決**: Dockerfileのコピー処理を確認、再ビルド

### 問題3: 接続はできるがメッセージが届かない

**原因**: Nginxでのバッファリングまたはタイムアウト
**解決**: proxy_buffering off、proxy_read_timeoutを適切に設定

### 問題4: 開発環境では動作するがプロダクションで失敗

**原因**: 環境変数やURL生成ロジックの違い  
**解決**: NODE_ENV=productionでの動作確認、ポート番号の扱いをチェック

## パフォーマンス最適化

### Socket.IO設定

```javascript
pingTimeout: 60000,      // 60秒
pingInterval: 25000,     // 25秒  
upgradeTimeout: 30000,   // 30秒
maxHttpBufferSize: 1e6   // 1MB
```

### Docker設定

```dockerfile
ENV UV_THREADPOOL_SIZE=4
ENV NODE_OPTIONS="--max-old-space-size=1024 --max-http-header-size=16384"
```

## 監視設定

### ヘルスチェック

各コンテナにヘルスチェックを設定済み：

- アプリ: `/api/health`
- PostgreSQL: `pg_isready`
- Redis: `redis-cli ping`
- Nginx: `/health`

### メトリクス確認

```bash
# コンテナリソース使用量
docker stats

# ネットワーク情報
docker network inspect mahjong-network
```
