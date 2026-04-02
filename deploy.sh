#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "Pulling latest..."
git pull

echo "Installing dependencies..."
npm ci

echo "Building frontend..."
npm run build

echo "Restarting server..."
pm2 restart goals || pm2 start server/index.js --name goals

echo "Done."
