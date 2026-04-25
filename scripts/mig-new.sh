#!/usr/bin/env bash
# 새 Supabase migration 파일 생성 — local TZ (= KST) timestamp 사용.
# usage: bun run mig:new <title>          (e.g. add_block_emotion)

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "usage: bun run mig:new <title>" >&2
  echo "  e.g. bun run mig:new add_block_emotion" >&2
  exit 1
fi

title="$1"
ts="$(date +%Y%m%d%H%M%S)"
human="$(date '+%Y-%m-%d %H:%M:%S %Z')"

# project root 기준 (npm/bun script 는 package.json dir 에서 실행됨)
file="supabase/migrations/${ts}_${title}.sql"

if [ -e "$file" ]; then
  echo "already exists: $file" >&2
  exit 1
fi

cat > "$file" <<EOF
-- ============================================================
-- ${ts}_${title}.sql — TODO: 한 줄 설명
-- ${human}
--
-- 실행: Supabase 대시보드 → SQL Editor → New query → 붙여넣기 → Run
-- ============================================================

EOF

echo "created: $file"
