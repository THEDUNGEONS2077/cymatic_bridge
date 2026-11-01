#!/usr/bin/env bash
# scripts/deploy.sh: tests and publishes cymatic_bridge to GitHub Pages
# (https://thedungeons2077.github.io/cymatic_bridge/).
#
# cyberdeck_terminal's deploy, adapted. Publishing is public: only run this
# after the user has said yes to this deploy.
#
# Steps (any failure stops before anything is published):
#   1. types, lint and unit tests (npm run check),
#   2. build at the site root and run the full browser walk (e2e/walk.mjs),
#   3. build again for the /cymatic_bridge/ path GitHub Pages serves it
#      from, walk that build at that path, and run it with the real title
#      bridge at that path (e2e/bridge.mjs),
#   4. publish it as this repo's `gh-pages` branch (replacing the old one),
#   5. turn on GitHub Pages for that branch the first time.
# The walks run headless (CB_HEADLESS=1): they hear music made in the page,
# so a covered WSLg window (frames at ~1 a second) can't fail a deploy.
#
# The site is static files only: no server code, no analytics, no tracking.
# Each person's settings stay in their own browser (IndexedDB); the music
# never leaves it.
set -euo pipefail
cd "$(dirname "$0")/.."

REPO=THEDUNGEONS2077/cymatic_bridge
BASE=/cymatic_bridge/
URL="https://thedungeons2077.github.io$BASE"
export CB_HEADLESS=1

# Publish only committed code, so the site always matches a commit.
[ -z "$(git status --porcelain)" ] || { echo "✕ uncommitted changes; commit first" >&2; exit 1; }
COMMIT="$(git rev-parse --short HEAD)"

# 1. Static checks and unit tests.
npm run check

# 2. The full walk against a root build.
npm run build
npm run e2e

# 3. The real build for GitHub Pages' path, walked at that path, with the real title bridge.
CYMATIC_BASE="$BASE" npm run build
CYMATIC_BASE="$BASE" node e2e/walk.mjs
CYMATIC_BASE="$BASE" node e2e/bridge.mjs

# 4. Replace the gh-pages branch with this build (a fresh one-commit branch: no history kept).
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp -r dist/. "$TMP/"
# No Jekyll processing: serve the files exactly as built.
touch "$TMP/.nojekyll"
git -C "$TMP" init -q -b gh-pages
git -C "$TMP" add -A
git -C "$TMP" -c user.name="$(git config user.name)" -c user.email="$(git config user.email)" commit -q -m "Build of $COMMIT"
git -C "$TMP" push -q --force "$(git remote get-url origin)" gh-pages
echo "✓ gh-pages updated (build of $COMMIT)"

# 5. Enable Pages on the branch if it isn't yet (GitHub then publishes the site in a minute or two).
#    GitHub may already have switched it on by itself; "already enabled" is fine.
if ! gh api "repos/$REPO/pages" >/dev/null 2>&1; then
  if gh api -X POST "repos/$REPO/pages" -f "source[branch]=gh-pages" -f "source[path]=/" >/dev/null 2>&1; then
    echo "✓ GitHub Pages enabled"
  else
    gh api "repos/$REPO/pages" >/dev/null || { echo "✕ couldn't enable GitHub Pages" >&2; exit 1; }
  fi
fi
echo "✓ deployed: $URL (live once GitHub finishes publishing)"
