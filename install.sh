#!/bin/bash
echo "Running pnpm install on frontend"

cd ./frontend || exit
pnpm install

echo "Frontend packages installed"

cd ../backend || exit

pnpm install

echo "Backend packages install"
echo "Install complete"
