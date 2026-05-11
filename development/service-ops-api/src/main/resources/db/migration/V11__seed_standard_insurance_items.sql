-- Seed the standard insurance items dictated by Korean paid-transport (유상운송)
-- regulation. The operator does not create insurance items via admin UI any
-- more - they are an external fixed catalog. Adding a new product means a
-- new Flyway migration here, not a runtime CRUD action.
--
-- Four items in this slice:
--   PRIMARY (12개월 메인):
--     - 유상운송종합보험 (general)
--     - 유상운송책임보험 (liability)
--   ADDON (단기 부가):
--     - 시간제 보험 (hourly)
--     - 원데이 보험 (one-day)
--
-- Idempotency: `on conflict (id) do nothing` so the migration is safe in
-- environments where someone manually inserted matching rows during dev.
-- Fixed UUIDs let dev / staging / prod reference the same canonical ids.

insert into insurance_items (
    id, name, description, enabled,
    category, coverage_type, default_duration_unit, default_duration_value
) values
    ('11111111-0000-4000-8000-000000000001',
     '유상운송종합보험',
     '12개월 단위 메인 종합 보험 (유상운송).',
     true,
     'PRIMARY', 'GENERAL_PAID_TRANSPORT', 'YEAR', 1),
    ('11111111-0000-4000-8000-000000000002',
     '유상운송책임보험',
     '12개월 단위 메인 책임 보험 (유상운송).',
     true,
     'PRIMARY', 'LIABILITY_PAID_TRANSPORT', 'YEAR', 1),
    ('11111111-0000-4000-8000-000000000003',
     '시간제 보험',
     '시간 단위 부가 보험 (단기).',
     true,
     'ADDON', 'HOURLY', 'HOUR', 1),
    ('11111111-0000-4000-8000-000000000004',
     '원데이 보험',
     '하루 단위 부가 보험 (단기).',
     true,
     'ADDON', 'ONE_DAY', 'DAY', 1)
on conflict (id) do nothing;
