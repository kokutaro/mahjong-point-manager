#!/bin/sh
set -e

echo "Starting Docker entrypoint script..."
echo "Node.js version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "Current directory: $(pwd)"
echo "Directory contents:"
ls -la

# デバッグ: socket.ioモジュールの存在確認
echo "Checking for socket.io module..."
if [ -d "./node_modules/socket.io" ]; then
  echo "✅ socket.io found in node_modules"
else
  echo "❌ socket.io NOT found in node_modules"
  echo "Available modules in node_modules:"
  ls -la ./node_modules/ | grep socket || echo "No socket-related modules found"
fi

echo "Environment variables:"
env | grep -E "NODE_ENV|DATABASE_URL|PORT" || echo "No relevant env vars found"

# データベースの準備ができるまで待機
echo "Waiting for database to be ready..."
timeout=60
counter=0

until npx prisma db push --accept-data-loss > /dev/null 2>&1; do
  counter=$((counter + 1))
  if [ $counter -gt $timeout ]; then
    echo "Error: Database connection timeout after ${timeout} seconds"
    exit 1
  fi
  echo "Database not ready yet, retrying in 2 seconds... ($counter/$timeout)"
  sleep 2
done

echo "Database is ready!"

# Prisma clientの生成
echo "Generating Prisma client..."
npx prisma generate

# アプリケーションの起動
echo "Starting application..."
exec node server.js