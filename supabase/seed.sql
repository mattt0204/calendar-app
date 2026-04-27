-- ============================================================
-- seed.sql — dogfooding 시연용 1회 INSERT
-- 2026-04-25 (오늘) plan_blocks 6개 + 그에 연결된 subjects 6개 + area 샘플 2개
--
-- 실행: Supabase 대시보드 → SQL Editor → New query → 붙여넣기 → Run
-- 재실행 안전: subjects (name, kind) UNIQUE → ON CONFLICT 로 skip.
--             plan_blocks 는 매번 새 row 추가됨 — 중복 원치 않으면 먼저 DELETE.
--
-- subjects.kind: 'product' (SW product) | 'area' (pa/1_self/area/*)
-- ============================================================

-- ── subjects (carryover 지원: 이미 있으면 카테고리만 갱신) ──
INSERT INTO subjects (name, category, kind) VALUES
  ('아침 루틴',     '3_건강',     'product'),
  ('강의 자료',     '1_업무',     'product'),
  ('스크립트 완성', '1_업무',     'product'),
  ('운영진 미팅',   '1_업무',     'product'),
  ('쇼핑',          '8_기타',     'product'),
  ('네트워킹',      '2_인간관계', 'product'),
  -- area 샘플 (pa/1_self/area/* 의 일부 — sync 스크립트가 주 진입점)
  ('영어학습',      '6_언어',     'area'),
  ('건강관리',      '3_건강',     'area')
ON CONFLICT (name, kind) DO UPDATE SET category = EXCLUDED.category;

-- ── plan_blocks (오늘) ──
-- 같은 날짜 재seed 원할 때:  DELETE FROM plan_blocks WHERE date = '2026-04-25';
INSERT INTO plan_blocks (date, start_time, end_time, subject_id) VALUES
  ('2026-04-25', '09:00:00', '10:00:00', (SELECT id FROM subjects WHERE name = '아침 루틴'    AND kind = 'product')),
  ('2026-04-25', '10:30:00', '12:00:00', (SELECT id FROM subjects WHERE name = '강의 자료'    AND kind = 'product')),
  ('2026-04-25', '13:00:00', '14:00:00', (SELECT id FROM subjects WHERE name = '스크립트 완성' AND kind = 'product')),
  ('2026-04-25', '14:00:00', '15:30:00', (SELECT id FROM subjects WHERE name = '운영진 미팅'   AND kind = 'product')),
  ('2026-04-25', '15:30:00', '16:30:00', (SELECT id FROM subjects WHERE name = '쇼핑'         AND kind = 'product')),
  ('2026-04-25', '18:00:00', '20:00:00', (SELECT id FROM subjects WHERE name = '네트워킹'      AND kind = 'product'));

-- ── actual_blocks (오늘 — drift 시연용) ──
-- plan 과 의도적으로 약간 어긋남: 늦게 시작 / 일찍 끝남 / 일부 안 함.
-- 같은 날짜 재seed:  DELETE FROM actual_blocks WHERE date = '2026-04-25';
INSERT INTO actual_blocks (date, start_time, end_time, subject_id) VALUES
  ('2026-04-25', '09:00:00', '10:15:00', (SELECT id FROM subjects WHERE name = '아침 루틴'    AND kind = 'product')),  -- 15분 over
  ('2026-04-25', '10:30:00', '11:45:00', (SELECT id FROM subjects WHERE name = '강의 자료'    AND kind = 'product')),  -- 15분 short
  ('2026-04-25', '13:00:00', '14:00:00', (SELECT id FROM subjects WHERE name = '스크립트 완성' AND kind = 'product')),  -- 정확
  ('2026-04-25', '14:00:00', '15:30:00', (SELECT id FROM subjects WHERE name = '운영진 미팅'   AND kind = 'product')),  -- 정확
  -- '쇼핑' 은 안 함 (drift = plan 만 있고 actual 없음)
  ('2026-04-25', '18:00:00', '19:30:00', (SELECT id FROM subjects WHERE name = '네트워킹'      AND kind = 'product'));  -- 30분 short

-- 확인:
-- SELECT pb.date, pb.start_time, pb.end_time, s.name, s.category, s.kind
-- FROM plan_blocks pb JOIN subjects s ON s.id = pb.subject_id
-- WHERE pb.date = '2026-04-25' ORDER BY pb.start_time;
--
-- SELECT ab.date, ab.start_time, ab.end_time, s.name, s.kind
-- FROM actual_blocks ab JOIN subjects s ON s.id = ab.subject_id
-- WHERE ab.date = '2026-04-25' ORDER BY ab.start_time;
