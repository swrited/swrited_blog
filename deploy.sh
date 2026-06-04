#!/bin/bash
set -e

echo ">>> Building site..."
pnpm run build

echo ">>> Deploying dist/ to GitHub Pages..."
cd dist

# 清理可能存在的旧 git 目录，确保干净
rm -rf .git

git init
git add -A
git commit -m "deploy: $(date '+%Y-%m-%d %H:%M:%S')"

# 强制推送到 swrited.github.io 的 main 分支，覆盖原有源码
git push -f git@github.com:swrited/swrited.github.io.git main

cd -
echo ">>> Done! Your site has been deployed."
