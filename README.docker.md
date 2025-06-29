# 🐳 Docker で麻雀点数管理アプリを実行する

このガイドでは、Docker と Docker Compose を使用してアプリケーションを実行する方法を説明します。

## 📋 前提条件

- Docker 20.10+
- Docker Compose 2.0+

## 🚀 クイックスタート

### 1. 環境変数の設定

```bash
# 環境変数ファイルをコピー
cp .env.docker .env.docker.local

# 環境変数を編集（必須）
vim .env.docker.local
```

最低限、以下の値を変更してください：

- `POSTGRES_PASSWORD`: データベースのパスワード
- `NEXTAUTH_SECRET`: 32文字以上のランダムな文字列

### 2. 開発環境での実行

```bash
# 開発環境でコンテナを起動（ホットリロード有効）
docker-compose -f docker-compose.dev.yml --env-file .env.docker.local up -d

# ログを確認
docker-compose -f docker-compose.dev.yml logs -f app

# 停止
docker-compose -f docker-compose.dev.yml down
```

### 3. プロダクション環境での実行

```bash
# プロダクション環境でコンテナを起動
docker-compose -f docker-compose.prod.yml --env-file .env.docker.local up -d

# ログを確認
docker-compose -f docker-compose.prod.yml logs -f app

# 停止
docker-compose -f docker-compose.prod.yml down
```

### 4. 標準環境での実行

```bash
# 基本設定でコンテナを起動
docker-compose --env-file .env.docker.local up -d

# 停止
docker-compose down
```

## 🔧 詳細設定

### データベースの初期化

初回実行時に、データベースのマイグレーションとシードデータの投入が必要です：

```bash
# アプリケーションコンテナ内でマイグレーション実行
docker-compose exec app npx prisma migrate deploy

# シードデータの投入
docker-compose exec app npx prisma db seed
```

### データベースのリセット

```bash
# データベースをリセット（全データ削除）
docker-compose exec app npx prisma migrate reset

# または、ボリュームを削除して完全リセット
docker-compose down -v
docker volume rm mahjong-point-manager_postgres_data
```

## 📊 サービス構成

### 開発環境 (`docker-compose.dev.yml`)

- **app**: Next.js アプリケーション（ホットリロード有効）
- **postgres**: PostgreSQL データベース
- **redis**: Redis（セッション・キャッシュ用）

### プロダクション環境 (`docker-compose.prod.yml`)

- **app**: 最適化されたNext.js アプリケーション
- **postgres**: PostgreSQL データベース
- **redis**: Redis（最適化設定）
- **nginx**: リバースプロキシ

## 🔍 監視とヘルスチェック

### ヘルスチェック

```bash
# アプリケーションのヘルスチェック
curl http://localhost:3000/api/health

# データベースの接続確認
docker-compose exec postgres pg_isready -U mahjong_user -d mahjong_db

# Redis の接続確認
docker-compose exec redis redis-cli ping
```

### ログの確認

```bash
# 全サービスのログ
docker-compose logs -f

# 特定サービスのログ
docker-compose logs -f app
docker-compose logs -f postgres

# エラーログのみ
docker-compose logs --grep ERROR
```

## 🛠️ トラブルシューティング

### よくある問題

1. **ポートが既に使用されている**

   ```bash
   # ポート使用状況を確認
   lsof -i :3000
   lsof -i :5432

   # 環境変数でポートを変更
   echo "APP_PORT=3001" >> .env.docker.local
   ```

2. **データベース接続エラー**

   ```bash
   # PostgreSQL コンテナの状態確認
   docker-compose ps postgres

   # データベースログを確認
   docker-compose logs postgres
   ```

3. **ビルドエラー**

   ```bash
   # キャッシュをクリアしてリビルド
   docker-compose build --no-cache app

   # 全ての Docker キャッシュをクリア
   docker system prune -a
   ```

### パフォーマンス最適化

1. **メモリ使用量の監視**

   ```bash
   # コンテナのリソース使用状況
   docker stats
   ```

2. **ディスク使用量の確認**

   ```bash
   # Docker ボリューム使用量
   docker system df

   # 不要なボリュームの削除
   docker volume prune
   ```

## 🔐 セキュリティ

### プロダクション環境での注意点

1. **環境変数の管理**
   - `.env.docker.local` をバージョン管理に含めない
   - 強力なパスワードとシークレットキーを使用

2. **ネットワークセキュリティ**
   - 不要なポートを公開しない
   - ファイアウォールの設定

3. **定期的な更新**

   ```bash
   # イメージの更新
   docker-compose pull
   docker-compose up -d
   ```

## 📁 ファイル構成

```text
├── docker-compose.yml          # 基本設定
├── docker-compose.dev.yml      # 開発環境用
├── docker-compose.prod.yml     # プロダクション環境用
├── Dockerfile                  # プロダクションビルド用
├── Dockerfile.dev              # 開発環境用
├── .env.docker                 # 環境変数テンプレート
├── .env.docker.local           # 実際の環境変数（作成が必要）
└── README.docker.md            # このファイル
```

## 🆘 サポート

問題が発生した場合は、以下の情報と共にIssueを作成してください：

```bash
# 環境情報の収集
docker --version
docker-compose --version
docker-compose config
docker-compose ps
docker-compose logs app --tail=50
```
