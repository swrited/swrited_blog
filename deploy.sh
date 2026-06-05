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
PUBLISH_DIR="$(mktemp -d)"
cleanup() {
    rm -rf "$PUBLISH_DIR"
}
trap cleanup EXIT

git clone --depth 1 git@github.com:swrited/swrited.github.io.git "$PUBLISH_DIR"

# GitHub Pages/Fastly may keep serving stale HTML for hours. Do not delete old
# hashed Astro assets immediately, otherwise stale HTML can reference missing
# /_astro/*.js or /_astro/*.css files.
rsync -a --delete \
    --exclude ".git/" \
    --exclude "_astro/" \
    dist/ "$PUBLISH_DIR/"

if [ -d dist/_astro ]; then
    mkdir -p "$PUBLISH_DIR/_astro"
    rsync -a dist/_astro/ "$PUBLISH_DIR/_astro/"
fi

cd "$PUBLISH_DIR"
git add -A
if git diff --cached --quiet; then
    echo ">>> No changes to deploy."
else
    git commit -m "deploy: $(date '+%Y-%m-%d %H:%M:%S')"
    git push origin main
fi

cd -
echo ">>> Done! Your site has been deployed."
