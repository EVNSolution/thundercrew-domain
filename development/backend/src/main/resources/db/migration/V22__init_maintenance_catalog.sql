-- 정비 스케줄 도메인: 차량 단위 정비 catalog + 이벤트 이력. 두 테이블만 추가.
--
-- `maintenance_items` 가 카탈로그(품목 + 교환 주기 default) 를 보유하고,
-- `vehicle_maintenance_records` 가 운영자가 "이 차량 이 품목을 교환했다"
-- 마킹할 때마다 row 를 추가한다. "다음 교환 예정 / 임박 / 지연" 같은 derived
-- 표시는 서비스 코드에서 record.serviced_at + item.cycle_* 로 계산.
--
-- engine type 분리: `applies_to` 가 `ELECTRIC` / `ICE` / `BOTH` 셋. 차량 단위
-- 카탈로그 조회 시 (bike.engine_type 가 ELECTRIC 이면) `ELECTRIC` + `BOTH` 를
-- 합쳐서 노출. ICE 차량도 같은 패턴.
--
-- 단위 혼재: km 기반(엔진오일 1,500km), 시간 기반(체인 장력조절 1개월), 그리고
-- "12개월 이상", "6~7개월" 같은 비정형. `cycle_km` 와 `cycle_months` 가 둘 다
-- nullable 이고, `cycle_label` 이 자유 텍스트로 비정형 표현을 잡는다.
--
-- 그룹(구동계3종) 표현: 자식 품목이 `parent_item_id` 로 부모를 참조. 부모 자체
-- 의 cycle 은 NULL (그룹은 자체 cycle 없음, 자식이 각각 보유).

create table maintenance_items (
    id uuid primary key,
    idx bigserial not null,
    name varchar(100) not null,
    -- ELECTRIC = 전기 차량에만 적용, ICE = 내연기관에만, BOTH = 둘 다.
    applies_to varchar(20) not null,
    -- 그룹용 부모 참조. null 이면 단독 품목.
    parent_item_id uuid references maintenance_items(id) on delete restrict,
    -- 둘 다 nullable. 둘 중 하나만 채워질 수도, 둘 다 채워질 수도 있다.
    -- 둘 다 null 이지만 cycle_label 만 채워지는 경우(예: "운영자 판단") 도 허용.
    cycle_km integer,
    cycle_months integer,
    -- "6~7개월", "12개월 이상" 같이 cycle_km/months 로 표현 안 되는 비정형 텍스트.
    -- 채워져 있으면 UI 가 우선 표시. cycle_km/months 와 동시 보유 가능 (텍스트는
    -- 보조 설명).
    cycle_label varchar(50),
    -- 같은 applies_to 안에서 정렬 순서. 사진 표 순서 그대로 0,1,2,... 로 seed.
    display_order integer not null default 0,
    enabled boolean not null default true,
    memo text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    deleted_by uuid,
    constraint ck_maintenance_items_applies_to
        check (applies_to in ('ELECTRIC', 'ICE', 'BOTH')),
    constraint ck_maintenance_items_cycle_present
        check (cycle_km is not null or cycle_months is not null or cycle_label is not null)
);

create unique index ux_maintenance_items_idx on maintenance_items(idx);
create index ix_maintenance_items_applies_to_active
    on maintenance_items(applies_to)
    where deleted_at is null;
create index ix_maintenance_items_parent_active
    on maintenance_items(parent_item_id)
    where deleted_at is null;

create table vehicle_maintenance_records (
    id uuid primary key,
    idx bigserial not null,
    bike_id uuid not null references bikes(id) on delete restrict,
    item_id uuid not null references maintenance_items(id) on delete restrict,
    serviced_at timestamptz not null,
    -- 운영자가 교환 시점에 알고 있다면 같이 입력. 우리에게 odometer 텔레메트리가
    -- 없어 km 기준 품목은 운영자 보정 입력으로 보완한다 (계획서 옵션 (c)).
    serviced_at_odometer_km integer,
    memo text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    deleted_by uuid
);

create unique index ux_vehicle_maintenance_records_idx on vehicle_maintenance_records(idx);
create index ix_vehicle_maintenance_records_bike_active
    on vehicle_maintenance_records(bike_id, serviced_at desc)
    where deleted_at is null;
create index ix_vehicle_maintenance_records_item_active
    on vehicle_maintenance_records(item_id)
    where deleted_at is null;

-- ============================================================================
-- Seed: 사진 두 표 그대로
-- ============================================================================
--
-- 공통 품목(브레이크 패드, 타이어) 은 applies_to = BOTH 로 한 행만 박는다 —
-- ELECTRIC 차량 catalog 조회 시 `applies_to in ('ELECTRIC', 'BOTH')` 로 합쳐서
-- 노출하면 사진과 동일한 목록이 된다.
--
-- 구동계3종 은 그룹 부모 + 자식 3개. 부모 UUID 는 self-FK 참조 위해 literal 로
-- 고정.

-- ICE 단독 품목
insert into maintenance_items (id, name, applies_to, cycle_km, display_order) values
    ('aaaa1111-0001-4001-8001-000000000001'::uuid, '엔진오일', 'ICE', 1500, 10),
    ('aaaa1111-0001-4001-8001-000000000002'::uuid, '에어필터', 'ICE', 12000, 20),
    ('aaaa1111-0001-4001-8001-000000000003'::uuid, '점화플러그', 'ICE', 20000, 30),
    ('aaaa1111-0001-4001-8001-000000000006'::uuid, '브레이크오일 점검 및 보충', 'ICE', 30000, 60),
    ('aaaa1111-0001-4001-8001-000000000007'::uuid, '냉각수 점검 및 보충', 'ICE', 20000, 70);

-- 구동계3종 그룹 (부모) — cycle 없음.
insert into maintenance_items (id, name, applies_to, cycle_label, display_order, cycle_km) values
    ('aaaa1111-0001-4001-8001-000000000080'::uuid, '구동계3종', 'ICE', '그룹', 80, null);

-- 구동계3종 자식 세 품목 — 같은 부모 참조.
insert into maintenance_items (id, name, applies_to, parent_item_id, cycle_km, display_order) values
    ('aaaa1111-0001-4001-8001-000000000081'::uuid, '슬라이드피스',         'ICE', 'aaaa1111-0001-4001-8001-000000000080'::uuid, 15000, 81),
    ('aaaa1111-0001-4001-8001-000000000082'::uuid, '드라이브벨트',         'ICE', 'aaaa1111-0001-4001-8001-000000000080'::uuid, 15000, 82),
    ('aaaa1111-0001-4001-8001-000000000083'::uuid, '무브볼(웨이트롤러)',   'ICE', 'aaaa1111-0001-4001-8001-000000000080'::uuid, 15000, 83);

-- ELECTRIC 단독 품목
insert into maintenance_items (id, name, applies_to, cycle_months, cycle_label, cycle_km, display_order) values
    ('bbbb2222-0002-4002-8002-000000000001'::uuid, '대소기어',         'ELECTRIC', 12,   '12개월 이상', null, 110),
    ('bbbb2222-0002-4002-8002-000000000002'::uuid, '체인 장력조절',     'ELECTRIC', 1,    null,           null, 120),
    ('bbbb2222-0002-4002-8002-000000000003'::uuid, '체인 교체',         'ELECTRIC', 6,    '6~7개월',     null, 130),
    ('bbbb2222-0002-4002-8002-000000000004'::uuid, '모터오일',           'ELECTRIC', null, null,           30000, 140);

-- 공통 (BOTH) 품목 — 두 표 모두에 등장
insert into maintenance_items (id, name, applies_to, cycle_km, display_order) values
    ('cccc3333-0003-4003-8003-000000000001'::uuid, '브레이크 패드(앞)', 'BOTH', 4000,  210),
    ('cccc3333-0003-4003-8003-000000000002'::uuid, '브레이크 패드(뒤)', 'BOTH', 5000,  220),
    ('cccc3333-0003-4003-8003-000000000003'::uuid, '타이어(앞)',         'BOTH', 15000, 230),
    ('cccc3333-0003-4003-8003-000000000004'::uuid, '타이어(뒤)',         'BOTH', 12000, 240);
