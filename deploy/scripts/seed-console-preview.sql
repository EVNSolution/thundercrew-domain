-- 운영 콘솔 프리뷰 DB 시드.
--
-- 프리뷰 DB 는 Flyway 가 스키마만 만들고 데이터는 비어 있다. 로그인은 되지만 화면 대부분이
-- 빈 목록이라 흐름을 눌러볼 수 없다. 이 스크립트가 **260804 변경을 확인하기에 딱 맞는**
-- 최소 데이터를 넣는다.
--
--   용도(배송용/클린) · LPG 엔진 · 정비 6분류 · 직무/숙련도
--
-- 실행:
--   sudo -u postgres psql -d thundercrew_preview -f seed-console-preview.sql
--
-- 멱등하다. id 를 고정해 두고 `on conflict do nothing` 을 쓰므로 여러 번 돌려도 중복되지
-- 않는다. 값을 바꾸고 싶으면 해당 행을 지우고 다시 돌린다.
--
-- **운영 DB 에서는 실행되지 않는다.** 아래 가드가 데이터베이스 이름을 확인한다.

\set ON_ERROR_STOP on

do $$
begin
  if current_database() <> 'thundercrew_preview' then
    raise exception
      '이 스크립트는 프리뷰 DB 전용입니다. 현재 데이터베이스: %. 운영에 시드 데이터를 넣지 마세요.',
      current_database();
  end if;
end $$;

begin;

-- ── 계약 템플릿 ────────────────────────────────────────────────────────────────
-- 계약이 있어야 차량-라이더 연결과 배차 방식이 보인다.
--
-- 제약이 값을 강하게 묶는다. 짐작해서 넣으면 걸린다 — 실제로 SUBSCRIPTION 에
-- duration_value=1 을 넣었다가 ck_contract_templates_subscription_duration_fixed 로 막혔다.
--
--   SUBSCRIPTION  → duration_unit='MONTH' AND duration_value=12, return_type 필수
--   RENTAL        → duration_unit ∈ (DAY,WEEK,MONTH,QUARTER,HALF_YEAR), duration_value·return_type 필수
--
-- 구독은 연 단위 고정이고 렌탈은 기간을 고른다는 뜻이다. 두 종류를 다 넣어 계약 화면에서
-- 분류가 구분되는지 본다.
insert into contract_templates (id, name, description, enabled, system_template, category, return_type, duration_unit, duration_value, includes_insurance)
values
  ('c0000000-0000-4000-8000-000000000001', '프리뷰 구독 · 인수', '시드 데이터', true, false, 'SUBSCRIPTION', 'TAKEOVER', 'MONTH', 12, false),
  ('c0000000-0000-4000-8000-000000000002', '프리뷰 월 렌탈 · 반납', '시드 데이터', true, false, 'RENTAL',      'RETURN',   'MONTH', 1,  false)
on conflict (id) do nothing;

-- ── 차량 ───────────────────────────────────────────────────────────────────────
-- (휠 × 엔진) 6분류를 **전부** 덮는다. 정비 화면에서 분류별로 다른 품목이 뜨는지 볼 수 있다.
-- 용도도 섞어 둔다 — 목록 필터와 용도 칩이 동작하는지 확인용.
--
--   2륜 전기 / 2륜 내연 / 2륜 LPG / 4륜 전기 / 4륜 내연 / 4륜 LPG
insert into bikes (id, plate_number, vin, model_name, operation_status, engine_type, wheel_type, purpose, ignition_blocked, memo)
values
  ('b0000000-0000-4000-8000-000000000001', '프리뷰 12가 3456', 'PREVIEW-VIN-0001', '대창 EV-3',    'IN_SERVICE', 'ELECTRIC', 'TWO_WHEEL',  'DELIVERY', false, '시드: 2륜 전기 배송용'),
  ('b0000000-0000-4000-8000-000000000002', '프리뷰 34나 7788', 'PREVIEW-VIN-0002', '혼다 PCX',     'READY',      'ICE',      'TWO_WHEEL',  'DELIVERY', false, '시드: 2륜 내연 배송용'),
  ('b0000000-0000-4000-8000-000000000003', '프리뷰 56다 1122', 'PREVIEW-VIN-0003', '대림 LPG-125', 'READY',      'LPG',      'TWO_WHEEL',  'DELIVERY', false, '시드: 2륜 LPG — 260804 신규 분류'),
  ('b0000000-0000-4000-8000-000000000004', '프리뷰 78라 9900', 'PREVIEW-VIN-0004', '기아 니로 EV', 'IN_SERVICE', 'ELECTRIC', 'FOUR_WHEEL', 'CLEANING', false, '시드: 4륜 전기 클린차량'),
  ('b0000000-0000-4000-8000-000000000005', '프리뷰 90마 3344', 'PREVIEW-VIN-0005', '현대 포터',    'READY',      'ICE',      'FOUR_WHEEL', 'CLEANING', false, '시드: 4륜 내연 클린차량'),
  ('b0000000-0000-4000-8000-000000000006', '프리뷰 12나 5566', 'PREVIEW-VIN-0006', '기아 봉고 LPG','IN_SERVICE', 'LPG',      'FOUR_WHEEL', 'CLEANING', false, '시드: 4륜 LPG — 260804 신규 분류')
on conflict (id) do nothing;

-- ── 인력 ───────────────────────────────────────────────────────────────────────
-- 직무(라이더/클리너)와 숙련도를 섞는다. **숙련도가 null 인 사람을 반드시 하나 둔다** —
-- "아직 판단하지 않음" 과 "초보" 가 화면에서 구분되는지 봐야 한다.
--
-- 앱 연동은 세 컬럼이 함께 움직인다(ck_riders_app_link_consistency):
--   linked=false → account_id·linked_at 둘 다 null
--   linked=true  → 둘 다 not null
-- linked=true 에 account_id 만 비워두면 막힌다. 실제로 그렇게 넣었다가 걸렸다.
insert into riders (id, name, phone_number, team_name, area_name,
                    app_account_linked, app_account_id, app_linked_at,
                    role, skill_level, training_status, memo)
values
  ('a0000000-0000-4000-8000-000000000001', '프리뷰 김도현', '010-9000-0001', '강남팀', '강남권',
   true,  'a1110000-0000-4000-8000-000000000001', now() - interval '25 days',
   'RIDER',   'EXPERT',       'ONLINE',  '시드: 고수 라이더, 앱 연동됨'),
  ('a0000000-0000-4000-8000-000000000002', '프리뷰 이수민', '010-9000-0002', '강남팀', '강남권',
   false, null, null,
   'RIDER',   'BEGINNER',     'OFFLINE', '시드: 초보 라이더'),
  ('a0000000-0000-4000-8000-000000000003', '프리뷰 정민아', '010-9000-0003', '마포팀', '마포권',
   false, null, null,
   'RIDER',   null,           null,      '시드: 숙련도 미판정 — null 과 BEGINNER 는 다른 상태다'),
  ('a0000000-0000-4000-8000-000000000004', '프리뷰 한소희', '010-9000-0004', '클린팀', '송파권',
   true,  'a1110000-0000-4000-8000-000000000004', now() - interval '12 days',
   'CLEANER', 'INTERMEDIATE', 'ONLINE',  '시드: 클리너, 앱 연동됨'),
  ('a0000000-0000-4000-8000-000000000005', '프리뷰 박지호', '010-9000-0005', '클린팀', '송파권',
   false, null, null,
   'CLEANER', 'EXPERT',       'ONLINE',  '시드: 클리너')
on conflict (id) do nothing;

-- ── 계약 ───────────────────────────────────────────────────────────────────────
-- 배차 방식을 섞는다. 용도(차량)와 배차 방식(계약)이 **직교하는 축**임을 눈으로 확인할 수
-- 있어야 한다 — 배송용 차량이 SINGLE 로도 CALL 로도 계약될 수 있다.
insert into rider_bike_contracts (id, rider_id, bike_id, contract_template_id, start_at, service_type, memo)
values
  ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', now() - interval '30 days', 'CALL',       '시드: 배송용 + 콜배차'),
  ('d0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', now() - interval '20 days', 'SINGLE',     '시드: 배송용 + 단일배차'),
  ('d0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', now() - interval '15 days', 'SEQUENTIAL', '시드: 클린차량 + 순차배차'),
  ('d0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000001', now() - interval '10 days', 'SEQUENTIAL', '시드: 클린차량 + 순차배차')
on conflict (id) do nothing;

-- ── 정비 품목 ──────────────────────────────────────────────────────────────────
-- 분류별로 다른 품목이 뜨는지 보려면 품목이 분류에 걸쳐 있어야 한다.
insert into maintenance_items (id, name, cycle_km, cycle_months, alert_threshold_percent, memo)
values
  ('e0000000-0000-4000-8000-000000000001', '프리뷰 브레이크 패드(앞)', 5000,  null, 85, '시드: 6분류 전체 공통'),
  ('e0000000-0000-4000-8000-000000000002', '프리뷰 엔진오일',          10000, null, 85, '시드: 연소기관만 (ICE·LPG)'),
  ('e0000000-0000-4000-8000-000000000003', '프리뷰 감속기 오일',       null,  12,   85, '시드: 전기만'),
  ('e0000000-0000-4000-8000-000000000004', '프리뷰 LPG 봄베 검사',     null,  24,   90, '시드: LPG 전용 — 260804 로 생긴 분류')
on conflict (id) do nothing;

-- 품목 ↔ 분류. LPG 2분류가 실제로 쓰이는지가 이번 확인의 핵심이다.
insert into maintenance_item_categories (maintenance_item_id, category)
values
  ('e0000000-0000-4000-8000-000000000001', 'TWO_WHEEL_ELECTRIC'),
  ('e0000000-0000-4000-8000-000000000001', 'TWO_WHEEL_ICE'),
  ('e0000000-0000-4000-8000-000000000001', 'TWO_WHEEL_LPG'),
  ('e0000000-0000-4000-8000-000000000001', 'FOUR_WHEEL_ELECTRIC'),
  ('e0000000-0000-4000-8000-000000000001', 'FOUR_WHEEL_ICE'),
  ('e0000000-0000-4000-8000-000000000001', 'FOUR_WHEEL_LPG'),
  ('e0000000-0000-4000-8000-000000000002', 'TWO_WHEEL_ICE'),
  ('e0000000-0000-4000-8000-000000000002', 'TWO_WHEEL_LPG'),
  ('e0000000-0000-4000-8000-000000000002', 'FOUR_WHEEL_ICE'),
  ('e0000000-0000-4000-8000-000000000002', 'FOUR_WHEEL_LPG'),
  ('e0000000-0000-4000-8000-000000000003', 'TWO_WHEEL_ELECTRIC'),
  ('e0000000-0000-4000-8000-000000000003', 'FOUR_WHEEL_ELECTRIC'),
  ('e0000000-0000-4000-8000-000000000004', 'TWO_WHEEL_LPG'),
  ('e0000000-0000-4000-8000-000000000004', 'FOUR_WHEEL_LPG')
on conflict (maintenance_item_id, category) do nothing;

-- 정비 실시 기록. 주기 소진율이 계산되는지 보려면 기준선이 필요하다.
-- 일부 차량은 일부러 비워 둔다 — 기록이 없는 상태가 화면에서 어떻게 보이는지도 확인 대상이다.
insert into vehicle_maintenance_records (id, bike_id, item_id, serviced_at, serviced_at_odometer_km, memo)
values
  ('f0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', now() - interval '20 days', 4200,  '시드'),
  ('f0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', now() - interval '300 days', 3000, '시드: 12개월 주기에 임박'),
  ('f0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000004', now() - interval '700 days', 8000, '시드: 24개월 주기 초과 — LPG 봄베'),
  ('f0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000006', 'e0000000-0000-4000-8000-000000000002', now() - interval '40 days',  12000, '시드')
on conflict (id) do nothing;

-- ── 장비 (함체) ────────────────────────────────────────────────────────────────
-- 함체는 배송용 차량에만 붙는다. 용도 이동을 막는 조건이기도 하다.
insert into equipment_types (id, name, description, enabled)
values ('11110000-0000-4000-8000-000000000001', '프리뷰 함체', '시드 데이터', true)
on conflict (id) do nothing;

insert into bike_equipments (id, bike_id, equipment_type_id, equipment_label, serial_number, installed_at, management_due_date, memo)
values
  ('22220000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', '11110000-0000-4000-8000-000000000001', '함체 A', 'PRV-BOX-0001', now() - interval '60 days', (now() + interval '120 days')::date, '시드'),
  ('22220000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', '11110000-0000-4000-8000-000000000001', '함체 B', 'PRV-BOX-0002', now() - interval '50 days', (now() + interval '130 days')::date, '시드')
on conflict (id) do nothing;

-- ── 스테이션 ───────────────────────────────────────────────────────────────────
-- 관제 지도에 핀이 하나도 없으면 화면이 비어 보인다. 주소가 유니크 키다(V17).
insert into battery_stations (id, name, address, latitude, longitude, status, max_battery_capacity, current_battery_count, available_battery_count, memo)
values
  ('33330000-0000-4000-8000-000000000001', '프리뷰 역삼 스테이션', '서울 강남구 테헤란로 프리뷰 1', 37.5006000, 127.0364000, 'ACTIVE', 12, 8, 5, '시드'),
  ('33330000-0000-4000-8000-000000000002', '프리뷰 잠실 스테이션', '서울 송파구 올림픽로 프리뷰 2', 37.5133000, 127.1000000, 'ACTIVE', 10, 6, 4, '시드')
on conflict (id) do nothing;

commit;

-- ── 결과 ───────────────────────────────────────────────────────────────────────
\echo ''
\echo '=== 시드 결과 ==='
select 'bikes' as 테이블, count(*) as 건수 from bikes where deleted_at is null
union all select 'riders', count(*) from riders where deleted_at is null
union all select 'contracts', count(*) from rider_bike_contracts where deleted_at is null
union all select 'maintenance_items', count(*) from maintenance_items where deleted_at is null
union all select 'maintenance_records', count(*) from vehicle_maintenance_records where deleted_at is null
union all select 'bike_equipments', count(*) from bike_equipments where deleted_at is null
union all select 'battery_stations', count(*) from battery_stations where deleted_at is null;

\echo ''
\echo '=== 260804 확인 포인트 ==='
select purpose as 용도, engine_type as 엔진, wheel_type as 휠, count(*) as 대수
from bikes where deleted_at is null group by 1,2,3 order by 1,2,3;

select coalesce(skill_level, '(미판정)') as 숙련도, role as 직무, count(*) as 명
from riders where deleted_at is null group by 1,2 order by 2,1;
