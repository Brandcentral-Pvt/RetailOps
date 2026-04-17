#!/bin/bash
# RetailOps Deploy Script - Run on VPS
# Usage: ./deploy.sh [options]

set -e

echo "🚀 RetailOps Deploy"
echo "=================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Config
APP_DIR="/var/www/retailops"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/retail-ops"

# Parse args
BRANCH="main"
SKIP_BUILD=false

while [[ $# -gt 0 ]]; do
  case $1 in
    -b|--branch) BRANCH="$2"; shift 2 ;;
    --skip-build) SKIP_BUILD=true; shift ;;
    *) shift ;;
  esac
done

echo -e "${YELLOW}Branch: $BRANCH${NC}"

# =====================
# Start deployment
# =====================

cd $APP_DIR

echo "📥 Pulling latest code..."
git checkout $BRANCH
git pull origin $BRANCH

# =====================
# Backend
# =====================
echo ""
echo "🔄 Building backend..."

cd $BACKEND_DIR
npm install --production

echo "🧹 Clearing old logs..."
pm2 delete retailops-backend 2>/dev/null || true

echo "🚀 Starting backend with increased memory..."
pm2 start server.js \
  --name retailops-backend \
  --max-old-space-size4096 \
  --update-env

# =====================
# Frontend
# =====================
if [ "$SKIP_BUILD" = false ]; then
  echo ""
  echo "🔄 Building frontend..."
  
  cd $FRONTEND_DIR
  npm install --legacy-peer-deps
  npm run build
  
  echo "🧹 Clearing old frontend..."
  pm2 delete retailops-frontend 2>/dev/null || true
  
  echo "🚀 Starting frontend preview..."
  pm2 start npm -- \
    -- run preview \
    --host \
    --port 4173 \
    --name retailops-frontend
fi

# =====================
# Show status
# =====================
echo ""
echo -e "${GREEN}✅ Deploy complete!${NC}"
echo ""
pm2 status

echo ""
echo "📊 Memory:"
free -h

echo ""
echo "🌐 Services:"
echo "  Backend:  http://localhost:3001"
echo "  Frontend: http://localhost:4173"