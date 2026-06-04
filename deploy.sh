#!/bin/bash
set -e

echo ">>> Building site..."
pnpm run build

# Vercel adapter 把 pagefind 搜索索引输出到 .vercel/output/static/pagefind/，
# 但 dist/ 里没有。手动拷一份到 dist/,否则部署后搜索功能 404
if [ -d .vercel/output/static/pagefind ]; then
    echo ">>> Copying pagefind index into dist/..."
    cp -R .vercel/output/static/pagefind dist/
else
    echo ">>> WARNING: .vercel/output/static/pagefind not found, search index will be missing"
fi

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
