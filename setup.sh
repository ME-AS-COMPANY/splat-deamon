#!/bin/bash
set -e

echo "[setup] Installing COLMAP..."
apt-get update -qq && apt-get install -y -qq colmap unzip ffmpeg

echo "[setup] Installing nerfstudio..."
pip install nerfstudio --ignore-installed blinker -q

echo "[setup] Installing Bun..."
curl -fsSL https://bun.sh/install | bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

echo "[setup] Setting up repo..."
cd /workspace
if [ -d "splat-deamon" ]; then
  echo "[setup] Repo exists, pulling latest..."
  cd splat-deamon && git pull
else
  git clone https://github.com/ME-AS-COMPANY/splat-deamon.git
  cd splat-deamon
fi

bun install

echo "[setup] Done. Set env vars then run: bun run src/index.ts"
