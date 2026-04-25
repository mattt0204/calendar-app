-- ============================================================
-- 20260425163625_disable_rls_dogfooding.sql — RLS off (dogfooding 단계)
-- 2026-04-25 16:36:25 KST
--
-- 배경: Supabase 신규 테이블 default = RLS ENABLE. policy 없으면 anon
--       INSERT/UPDATE/DELETE 막힘 (api-spec.md 의 single API key 인증 흐름과 충돌).
--       dogfooding (single user · private URL) 단계에선 RLS 의미 없음.
--
-- ⚠️ 외부 share·배포 전 되돌릴 것:
--    ALTER TABLE products       ENABLE ROW LEVEL SECURITY;
--    ALTER TABLE plan_blocks    ENABLE ROW LEVEL SECURITY;
--    ALTER TABLE actual_blocks  ENABLE ROW LEVEL SECURITY;
--    + JWT 기반 user-scoped policy (또는 OAuth 전환).
--    → api-spec.md "Auth" 섹션 disclosure 참조.
--
-- 적용: supabase db push
-- ============================================================

ALTER TABLE products       DISABLE ROW LEVEL SECURITY;
ALTER TABLE plan_blocks    DISABLE ROW LEVEL SECURITY;
ALTER TABLE actual_blocks  DISABLE ROW LEVEL SECURITY;
