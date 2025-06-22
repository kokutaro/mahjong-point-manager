# 麻雀点数管理アプリ

オンライン対応の麻雀点数計算・点棒管理アプリケーションです。

## 特徴

- 🎯 **正確な点数計算**: 翻数・符数から自動計算
- 🔄 **リアルタイム同期**: 4人のプレイヤーがオンラインで対戦
- 📱 **レスポンシブ対応**: スマートフォン・タブレット・PC対応
- 🎲 **完全な麻雀ルール**: 親ローテーション・本場・供託管理
- 💰 **精算機能**: ウマ・オカ・特殊ルール対応

## 技術スタック

- **フロントエンド**: Next.js 14, TypeScript, Tailwind CSS
- **状態管理**: Zustand
- **リアルタイム通信**: Socket.io
- **データベース**: PostgreSQL + Prisma
- **デプロイ**: Vercel

## 開発環境セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. PostgreSQL コンテナの起動

```bash
docker-compose up -d postgres
```

### 3. 環境変数の設定

```bash
cp .env.example .env.local
```

`.env.local` は既にコンテナ用の設定になっています。

### 4. データベースのセットアップ

```bash
# Prisma クライアント生成
npx prisma generate

# スキーマ適用
npx prisma db push

# 初期データ投入
npm run db:seed
```

### 5. 開発サーバーの起動

```bash
npm run dev
```

<http://localhost:3000> でアプリケーションが起動します。

## 使用方法

1. **ルーム作成**: ホーム画面から新しい対局ルームを作成
2. **ルーム参加**: 4桁のルームコードで参加
3. **対局開始**: 4人揃ったら自動で対局開始
4. **点数入力**: ツモ・ロンボタンから翻数・符数を入力
5. **自動計算**: 点数・本場・供託が自動で計算・分配
6. **結果確認**: 対局終了後に最終精算を表示

## スクリプト

### 開発・ビルド

- `npm run dev` - 開発サーバー起動
- `npm run build` - プロダクションビルド
- `npm run start` - プロダクションサーバー起動
- `npm run lint` - ESLint実行
- `npm run type-check` - TypeScript型チェック

### データベース

- `npm run db:seed` - 初期データ投入
- `npm run db:reset` - データベースリセット（危険）

### 便利コマンド

- `npx prisma studio` - データベースGUI (<http://localhost:5555>)
- `docker-compose down` - PostgreSQLコンテナ停止
- `curl http://localhost:3000/api/health` - ヘルスチェック

## ライセンス

MIT License
