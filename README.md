# my-calendar-app

Matt dogfooding 용 시간 추적 · 자기개선루프 데이터 소스.

전략 레이어 (product 정의 · epic · 티켓): `_meta/` (메타 repo 로 symlink).

## 스택

- Vite + React 19 + TypeScript
- Tailwind CSS v4
- Supabase (Postgres + Auth + Realtime + Edge Functions)
- Cloudflare Pages 배포

## 로컬 실행

```bash
bun install
cp .env.example .env  # Supabase URL / anon key 채우기
bun run dev
```

## 아키텍처

API-first — Supabase REST API 가 단일 진실원. Consumer:

- Web UI (primary, 이 repo)
- Discord 봇 (push 알림 + 슬래시커맨드) — 추후
- Claude (Code skill / API agent) — 추후
- iOS Siri 단축어 — 추후
