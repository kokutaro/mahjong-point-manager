#!/bin/bash

echo "=== 麻雀点数管理アプリ ネットワーク設定支援スクリプト ==="
echo ""

# 現在のIPアドレスを取得
echo "現在のネットワーク情報："
if command -v ip &> /dev/null; then
    # Linux
    IP_ADDRESS=$(ip route get 1 | sed -n 's/^.*src \([0-9.]*\) .*$/\1/p')
elif command -v ifconfig &> /dev/null; then
    # macOS/BSD
    IP_ADDRESS=$(ifconfig | grep -E "inet.*broadcast" | awk '{print $2}' | head -1)
else
    echo "IPアドレスの自動取得に失敗しました"
    read -p "手動でIPアドレスを入力してください: " IP_ADDRESS
fi

echo "検出されたIPアドレス: $IP_ADDRESS"
echo ""

# .env.prodファイルの更新
ENV_FILE=".env.prod"
if [ -f "$ENV_FILE" ]; then
    echo "環境変数ファイル ($ENV_FILE) を更新しています..."
    
    # バックアップ作成
    cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"
    
    # NEXTAUTH_URLを更新
    if grep -q "NEXTAUTH_URL=" "$ENV_FILE"; then
        sed -i.bak "s|NEXTAUTH_URL=.*|NEXTAUTH_URL=http://$IP_ADDRESS|g" "$ENV_FILE"
        echo "✅ NEXTAUTH_URL を http://$IP_ADDRESS に更新しました"
    else
        echo "NEXTAUTH_URL=http://$IP_ADDRESS" >> "$ENV_FILE"
        echo "✅ NEXTAUTH_URL を追加しました"
    fi
    
    # 一時的なバックアップファイルを削除
    rm -f "$ENV_FILE.bak"
    
    echo ""
    echo "更新された設定："
    grep "NEXTAUTH_URL" "$ENV_FILE"
    echo ""
else
    echo "❌ $ENV_FILE ファイルが見つかりません"
    echo "以下の内容で作成してください："
    echo ""
    echo "NEXTAUTH_URL=http://$IP_ADDRESS"
    echo "NEXTAUTH_SECRET=your-secret-key-here"
    echo "NODE_ENV=production"
    echo ""
fi

echo "=== 次の手順 ==="
echo "1. Docker Composeでアプリケーションを再起動："
echo "   docker-compose -f docker-compose.prod.yml down"
echo "   docker-compose -f docker-compose.prod.yml up -d"
echo ""
echo "2. ネットワーク内のデバイスから以下のURLでアクセス："
echo "   http://$IP_ADDRESS"
echo ""
echo "3. ファイアウォールでポート80を開放してください"
echo ""
echo "=== トラブルシューティング ==="
echo "- アクセスできない場合、ファイアウォール設定を確認"
echo "- WebSocketが接続できない場合、ブラウザの開発者ツールでエラーを確認"
echo "- クッキー問題の場合、ブラウザのキャッシュをクリア"