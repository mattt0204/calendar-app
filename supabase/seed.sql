-- ============================================================
-- seed.sql — dogfooding 시연용 1회 INSERT
-- 2026-04-25 (오늘) plan_blocks 6개 + 그에 연결된 products 6개
--
-- 실행: Supabase 대시보드 → SQL Editor → New query → 붙여넣기 → Run
-- 재실행 안전: products.name UNIQUE 제약 → 두 번 실행 시 ON CONFLICT 로 skip.
--             plan_blocks 는 매번 새 row 추가됨 — 중복 원치 않으면 먼저 DELETE.
-- ============================================================

-- ── products (carryover 지원: 이미 있으면 카테고리만 갱신) ──
INSERT INTO products (name, category) VALUES
  ('아침 루틴',    '3_건강'),
  ('강의 자료',    '1_업무'),
  ('스크립트 완성','1_업무'),
  ('운영진 미팅',  '1_업무'),
  ('쇼핑',         '8_기타'),
  ('네트워킹',     '2_인간관계')
ON CONFLICT (name) DO UPDATE SET category = EXCLUDED.category;

-- ── plan_blocks (오늘) ──
-- 같은 날짜 재seed 원할 때:  DELETE FROM plan_blocks WHERE date = '2026-04-25';
INSERT INTO plan_blocks (date, start_time, end_time, product_id) VALUES
  ('2026-04-25', '09:00:00', '10:00:00', (SELECT id FROM products WHERE name = '아침 루틴')),
  ('2026-04-25', '10:30:00', '12:00:00', (SELECT id FROM products WHERE name = '강의 자료')),
  ('2026-04-25', '13:00:00', '14:00:00', (SELECT id FROM products WHERE name = '스크립트 완성')),
  ('2026-04-25', '14:00:00', '15:30:00', (SELECT id FROM products WHERE name = '운영진 미팅')),
  ('2026-04-25', '15:30:00', '16:30:00', (SELECT id FROM products WHERE name = '쇼핑')),
  ('2026-04-25', '18:00:00', '20:00:00', (SELECT id FROM products WHERE name = '네트워킹'));

-- ── actual_blocks (오늘 — drift 시연용) ──
-- plan 과 의도적으로 약간 어긋남: 늦게 시작 / 일찍 끝남 / 일부 안 함.
-- 같은 날짜 재seed:  DELETE FROM actual_blocks WHERE date = '2026-04-25';
INSERT INTO actual_blocks (date, start_time, end_time, product_id) VALUES
  ('2026-04-25', '09:00:00', '10:15:00', (SELECT id FROM products WHERE name = '아침 루틴')),       -- 15분 over
  ('2026-04-25', '10:30:00', '11:45:00', (SELECT id FROM products WHERE name = '강의 자료')),       -- 15분 short
  ('2026-04-25', '13:00:00', '14:00:00', (SELECT id FROM products WHERE name = '스크립트 완성')),   -- 정확
  ('2026-04-25', '14:00:00', '15:30:00', (SELECT id FROM products WHERE name = '운영진 미팅')),     -- 정확
  -- '쇼핑' 은 안 함 (drift = plan 만 있고 actual 없음)
  ('2026-04-25', '18:00:00', '19:30:00', (SELECT id FROM products WHERE name = '네트워킹'));         -- 30분 short

-- 확인:
-- SELECT pb.date, pb.start_time, pb.end_time, p.name, p.category
-- FROM plan_blocks pb JOIN products p ON p.id = pb.product_id
-- WHERE pb.date = '2026-04-25' ORDER BY pb.start_time;
--
-- SELECT ab.date, ab.start_time, ab.end_time, p.name
-- FROM actual_blocks ab JOIN products p ON p.id = ab.product_id
-- WHERE ab.date = '2026-04-25' ORDER BY ab.start_time;
