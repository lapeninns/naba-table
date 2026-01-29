#!/usr/bin/env bash
set -euo pipefail

# SajiloReserveX - Single-command setup script
# Usage: ./scripts/setup.sh [--skip-install] [--skip-env]

echo "🚀 SajiloReserveX Setup"
echo ""

SKIP_INSTALL=false
SKIP_ENV=false

# Parse flags
for arg in "$@"; do
  case $arg in
    --skip-install)
      SKIP_INSTALL=true
      shift
      ;;
    --skip-env)
      SKIP_ENV=true
      shift
      ;;
    *)
      ;;
  esac
done

# 1. Install dependencies
if [ "$SKIP_INSTALL" = false ]; then
  echo "📦 Installing dependencies..."
  if ! command -v pnpm &> /dev/null; then
    echo "❌ Error: pnpm is not installed. Install it via:"
    echo "   npm install -g pnpm"
    echo "   or visit: https://pnpm.io/installation"
    exit 1
  fi
  pnpm install
  echo "✅ Dependencies installed"
  echo ""
else
  echo "⏭️  Skipping dependency installation (--skip-install)"
  echo ""
fi

# 2. Setup environment variables
if [ "$SKIP_ENV" = false ]; then
  if [ ! -f .env ]; then
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
    echo "✅ .env created (please update with your values)"
    echo ""
  else
    echo "ℹ️  .env already exists, skipping creation"
    echo ""
  fi
else
  echo "⏭️  Skipping .env setup (--skip-env)"
  echo ""
fi

# 3. Validate environment variables
echo "🔍 Validating environment variables..."
if pnpm validate:env; then
  echo "✅ Environment variables validated"
  echo ""
else
  echo "⚠️  Environment validation failed. Please check your .env file."
  echo "   Required variables are listed in .env.example"
  echo ""
  exit 1
fi

# 4. Summary
echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Update .env with your actual credentials"
echo "  2. Run 'pnpm dev' to start the development server"
echo "  3. Visit http://localhost:3000"
echo ""
echo "Useful commands:"
echo "  pnpm dev          - Start dev server"
echo "  pnpm build        - Build for production"
echo "  pnpm test         - Run tests"
echo "  pnpm lint         - Lint code"
echo "  pnpm typecheck    - Type check"
echo ""
