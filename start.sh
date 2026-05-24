#!/bin/bash
if [ "$1" == "DEV" ]; then

export NODE_ENV=development
(cd ./frontend 
pnpm run dev) &


(cd ./backend 
pnpm run dev)

elif [ "$1" == "PROD" ]; then
export NODE_ENV=production
cd ./frontend && pnpm run build 

cd ../backend && pnpm run build

elif [ "$1" == "TEST" ]; then
export NODE_ENV=production
cd ./frontend && pnpm run build:test

cd ../backend && pnpm run build
else
echo "Error: Please specify environment in agrument. (DEV or PROD)"
fi;
