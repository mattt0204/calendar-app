-- ============================================================
-- 20260427094758_subjects_rename.sql — products → subjects 통합 (kind 컬럼 추가)
-- 2026-04-27 09:47:58 KST
--
-- 배경: 시간 추적 단위가 SW product 만이 아니라 pa/1_self/area/* 도 포함됨.
--       product · area 를 한 테이블에서 다루기 위한 통합 마스터로 rename.
--
-- 변경 요지:
--   1) products → subjects rename
--   2) kind 컬럼 추가 ('product' | 'area', default 'product')
--   3) UNIQUE name → UNIQUE (name, kind) 복합 (같은 이름이 product/area 양쪽 가능)
--   4) plan_blocks · actual_blocks 의 product_id → subject_id rename + FK 재연결
--   5) get_or_create_product → get_or_create_subject (p_kind 인자 추가)
--   6) 관련 인덱스 · 트리거 rename
--
-- 실행: Supabase 대시보드 → SQL Editor → New query → 붙여넣기 → Run
-- ============================================================

-- ---- 1) 테이블 rename ----
ALTER TABLE products RENAME TO subjects;

-- ---- 2) kind 컬럼 추가 ----
ALTER TABLE subjects
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'product'
  CHECK (kind IN ('product', 'area'));

-- ---- 3) UNIQUE 제약 재정의: name → (name, kind) ----
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS products_name_key;
ALTER TABLE subjects ADD CONSTRAINT subjects_name_kind_key UNIQUE (name, kind);

-- ---- 4) blocks 테이블 컬럼 rename ----
ALTER TABLE plan_blocks RENAME COLUMN product_id TO subject_id;
ALTER TABLE actual_blocks RENAME COLUMN product_id TO subject_id;

-- FK constraint name 도 명시적으로 정리 (Postgres 자동 rename 안 됨)
ALTER TABLE plan_blocks
  DROP CONSTRAINT IF EXISTS plan_blocks_product_id_fkey,
  ADD CONSTRAINT plan_blocks_subject_id_fkey
    FOREIGN KEY (subject_id) REFERENCES subjects(id);

ALTER TABLE actual_blocks
  DROP CONSTRAINT IF EXISTS actual_blocks_product_id_fkey,
  ADD CONSTRAINT actual_blocks_subject_id_fkey
    FOREIGN KEY (subject_id) REFERENCES subjects(id);

-- ---- 5) 인덱스 rename ----
ALTER INDEX IF EXISTS idx_plan_blocks_product RENAME TO idx_plan_blocks_subject;
ALTER INDEX IF EXISTS idx_actual_blocks_product RENAME TO idx_actual_blocks_subject;

-- ---- 6) trigger rename (테이블 rename 후 trigger 이름은 자동 안 따라옴) ----
ALTER TRIGGER products_updated_at ON subjects RENAME TO subjects_updated_at;

-- ---- 7) RPC 함수: get_or_create_product → get_or_create_subject ----
DROP FUNCTION IF EXISTS get_or_create_product(TEXT, TEXT);

CREATE OR REPLACE FUNCTION get_or_create_subject(
  p_name     TEXT,
  p_category TEXT DEFAULT '8_기타',
  p_kind     TEXT DEFAULT 'product'
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM subjects WHERE name = p_name AND kind = p_kind;
  IF v_id IS NULL THEN
    INSERT INTO subjects (name, category, kind)
    VALUES (p_name, p_category, p_kind)
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;
