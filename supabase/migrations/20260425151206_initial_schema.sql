-- ============================================================
-- 20260425151206_initial_schema.sql — my-calendar-app 초기 schema
-- 2026-04-25 15:12:06 KST
--
-- 파일명 = <YYYYMMDDHHMMSS_KST>_<title>.sql → 자연 정렬 = 시간순.
-- ⚠️ Supabase CLI 기본은 UTC — `supabase migration new` 사용 시 UTC timestamp 생성됨.
--    이 프로젝트는 KST 로 통일 (Matt local 기준이 직관적). CLI 사용 시 수동 rename.
--
-- 실행: Supabase 대시보드 → SQL Editor → New query → 붙여넣기 → Run
-- 또는: supabase CLI `supabase db push` (CLI 세팅 후)
-- ============================================================

-- ============================================================
-- products (프로젝트 마스터)
-- ============================================================
CREATE TABLE products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  category    TEXT NOT NULL,
  color       TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),

  CHECK (category IN (
    '0_compass', '1_업무', '2_인간관계', '3_건강', '4_재무',
    '5_체화돌', '6_언어', '7_평판', '8_기타'
  ))
);

-- ============================================================
-- plan_blocks (계획 블록)
-- ============================================================
CREATE TABLE plan_blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE NOT NULL,
  start_time  TIME(0) NOT NULL,
  end_time    TIME(0) NOT NULL,
  product_id  UUID NOT NULL REFERENCES products(id),
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),

  CHECK (EXTRACT(MINUTE FROM start_time)::INTEGER % 15 = 0),
  CHECK (EXTRACT(MINUTE FROM end_time)::INTEGER % 15 = 0),
  CHECK (end_time > start_time)
);

-- ============================================================
-- actual_blocks (실측 블록 + 일정별 코멘트)
-- ============================================================
CREATE TABLE actual_blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE NOT NULL,
  start_time  TIME(0) NOT NULL,
  end_time    TIME(0) NOT NULL,
  product_id  UUID NOT NULL REFERENCES products(id),
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),

  CHECK (EXTRACT(MINUTE FROM start_time)::INTEGER % 15 = 0),
  CHECK (EXTRACT(MINUTE FROM end_time)::INTEGER % 15 = 0),
  CHECK (end_time > start_time)
);

-- ============================================================
-- updated_at 자동 갱신 trigger (공통)
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER plan_blocks_updated_at
  BEFORE UPDATE ON plan_blocks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER actual_blocks_updated_at
  BEFORE UPDATE ON actual_blocks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- get_or_create_product — Discord/Claude/Siri 발화 → product_id
-- ============================================================
CREATE OR REPLACE FUNCTION get_or_create_product(
  p_name     TEXT,
  p_category TEXT DEFAULT '8_기타'
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM products WHERE name = p_name;
  IF v_id IS NULL THEN
    INSERT INTO products (name, category) VALUES (p_name, p_category) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Index (리포트·집계 쿼리 대비)
-- ============================================================
CREATE INDEX idx_plan_blocks_date ON plan_blocks(date);
CREATE INDEX idx_plan_blocks_product ON plan_blocks(product_id);
CREATE INDEX idx_actual_blocks_date ON actual_blocks(date);
CREATE INDEX idx_actual_blocks_product ON actual_blocks(product_id);
