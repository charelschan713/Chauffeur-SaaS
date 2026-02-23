#!/bin/bash
# 同步平台更新到所有客户

set -e

echo "🚀 Starting client sync..."

CLIENTS_FILE="scripts/clients.json"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
TARGET_CLIENT="${1:-all}"
SKIP_MIGRATIONS="${SKIP_MIGRATIONS:-false}"

# 读取客户列表
clients=$(cat "$CLIENTS_FILE")
count=$(echo "$clients" | jq length)

echo "📋 Found $count clients"
echo "🎯 Target: $TARGET_CLIENT"

for i in $(seq 0 $(($count - 1))); do
  client=$(echo "$clients" | jq ".[$i]")
  name=$(echo "$client" | jq -r ".name")
  slug=$(echo "$client" | jq -r ".slug")
  active=$(echo "$client" | jq -r ".active")
  railway_backend=$(echo "$client" | jq -r ".railway_backend")
  supabase_url=$(echo "$client" | jq -r ".supabase_url")

  if [ "$active" != "true" ]; then
    echo "⏭️  Skipping inactive client: $name"
    continue
  fi

  if [ "$TARGET_CLIENT" != "all" ] && [ "$TARGET_CLIENT" != "$slug" ]; then
    continue
  fi

  echo ""
  echo "🔄 Syncing: $name"
  echo "   Railway: $railway_backend"
  echo "   Supabase: $supabase_url"

  # 1. 部署后端到客户 Railway
  echo "   📦 Deploying backend..."
  railway up --service "$railway_backend" || {
    echo "   ❌ Railway deploy failed for $name"
    continue
  }

  # 2. 跑新 migrations
  if [ "$SKIP_MIGRATIONS" = "true" ]; then
    echo "   ⏭️  Skipping migrations by flag"
  else
    echo "   🗄️ Running migrations..."
    DB_URL=$(echo "$client" | jq -r ".db_url")
    npx supabase db push --db-url "$DB_URL" || {
      echo "   ❌ Migration failed for $name"
      continue
    }
  fi

  echo "   ✅ $name synced successfully"
done

echo ""
echo "✅ Client sync finished at $TIMESTAMP"