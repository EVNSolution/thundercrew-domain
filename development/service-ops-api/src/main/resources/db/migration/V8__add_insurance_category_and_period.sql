-- Add classification and period columns to the insurance domain so the
-- operator can describe an item as PRIMARY (메인 12개월 단위 보험) or ADDON
-- (시간제 / 원데이 등 부가 보험), pick a coverage type aligned with the
-- 유상운송 product line, and stamp a rider-insurance link with its own
-- starts_at / ends_at lifecycle plus a no-FK pointer to the rider-bike
-- contract that triggered the insurance.
--
-- The unique policy on rider_insurances stays intact in this slice; multi-
-- issue policy for ADDON insurance is enforced at the service layer because
-- the rules depend on coverage_type and overlap windows, which a partial
-- unique index cannot express cleanly.

alter table insurance_items
    add column category varchar(20) not null default 'PRIMARY',
    add column coverage_type varchar(40),
    add column default_duration_unit varchar(20),
    add column default_duration_value integer;

alter table insurance_items
    add constraint ck_insurance_items_category
        check (category in ('PRIMARY', 'ADDON')),
    add constraint ck_insurance_items_coverage_type
        check (coverage_type is null or coverage_type in
            ('GENERAL_PAID_TRANSPORT', 'LIABILITY_PAID_TRANSPORT',
             'HOURLY', 'ONE_DAY', 'OTHER')),
    add constraint ck_insurance_items_default_duration_unit
        check (default_duration_unit is null or default_duration_unit in
            ('HOUR', 'DAY', 'WEEK', 'MONTH', 'QUARTER', 'HALF_YEAR', 'YEAR')),
    add constraint ck_insurance_items_default_duration_value
        check (default_duration_value is null or default_duration_value > 0);

create index ix_insurance_items_category_active
    on insurance_items(category)
    where deleted_at is null;

alter table rider_insurances
    add column starts_at timestamptz,
    add column ends_at timestamptz,
    add column rider_bike_contract_id uuid;

alter table rider_insurances
    add constraint ck_rider_insurances_period
        check (starts_at is null or ends_at is null or ends_at > starts_at);

create index ix_rider_insurances_period_active
    on rider_insurances(rider_id, starts_at, ends_at)
    where deleted_at is null;

create index ix_rider_insurances_contract_active
    on rider_insurances(rider_bike_contract_id)
    where rider_bike_contract_id is not null and deleted_at is null;

-- 기본 보험 4종 시드. ID 가 deterministic 이라 Slice A 의
-- contract_templates.default_insurance_item_id 가 향후 이 ID 를 가리킬 수
-- 있도록 한다 (현재 그 컬럼은 Slice A 에서 NULL 로 둔 상태).
insert into insurance_items (
    id, name, description, enabled,
    category, coverage_type, default_duration_unit, default_duration_value,
    created_at, updated_at
) values
    ('22222222-2222-2222-2222-000000000001', '유상운송종합보험', '12개월 메인 보험. 라이더 운영 표준 보험.',         true, 'PRIMARY', 'GENERAL_PAID_TRANSPORT', 'MONTH', 12, now(), now()),
    ('22222222-2222-2222-2222-000000000002', '유상운송책임보험', '12개월 메인 책임 보험.',                              true, 'PRIMARY', 'LIABILITY_PAID_TRANSPORT', 'MONTH', 12, now(), now()),
    ('22222222-2222-2222-2222-000000000003', '시간제보험',       '시간 단위 부가 보험.',                                 true, 'ADDON',   'HOURLY',                   'HOUR',   1, now(), now()),
    ('22222222-2222-2222-2222-000000000004', '원데이보험',       '하루 단위 부가 보험.',                                 true, 'ADDON',   'ONE_DAY',                  'DAY',    1, now(), now())
on conflict do nothing;
