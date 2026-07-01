-- Add business classification columns to contract_templates so the operator can
-- describe the template as 구독(SUBSCRIPTION) / 렌탈(RENTAL) / CUSTOM, choose
-- 인수형(TAKEOVER) vs 반납형(RETURN), pick a duration unit/value, and flag
-- whether the package includes a default insurance item.
--
-- The legacy duration_minutes column is preserved for read-side compatibility;
-- the new (duration_unit, duration_value) pair is the source of truth going
-- forward and must be present whenever the category is SUBSCRIPTION or RENTAL.
--
-- default_insurance_item_id is a no-FK uuid pointer per the cross-domain policy
-- (see integrity reference scan endpoint). The follow-up Slice B issue will add
-- the matching insurance category/period model.

alter table contract_templates
    add column category varchar(20) not null default 'CUSTOM',
    add column return_type varchar(20),
    add column duration_unit varchar(20),
    add column duration_value integer,
    add column includes_insurance boolean not null default false,
    add column default_insurance_item_id uuid;

alter table contract_templates
    add constraint ck_contract_templates_category
        check (category in ('SUBSCRIPTION', 'RENTAL', 'CUSTOM')),
    add constraint ck_contract_templates_return_type
        check (return_type is null or return_type in ('TAKEOVER', 'RETURN')),
    add constraint ck_contract_templates_duration_unit
        check (duration_unit is null
               or duration_unit in ('DAY', 'WEEK', 'MONTH', 'QUARTER', 'HALF_YEAR', 'YEAR')),
    add constraint ck_contract_templates_duration_value
        check (duration_value is null or duration_value > 0),
    add constraint ck_contract_templates_subscription_return_type_required
        check (category <> 'SUBSCRIPTION' or return_type is not null),
    add constraint ck_contract_templates_subscription_duration_fixed
        check (category <> 'SUBSCRIPTION'
               or (duration_unit = 'MONTH' and duration_value = 12)),
    add constraint ck_contract_templates_rental_return_type_required
        check (category <> 'RENTAL' or return_type is not null),
    add constraint ck_contract_templates_rental_duration_unit
        check (category <> 'RENTAL'
               or duration_unit in ('DAY', 'WEEK', 'MONTH', 'QUARTER', 'HALF_YEAR')),
    add constraint ck_contract_templates_rental_duration_value
        check (category <> 'RENTAL' or duration_value is not null);
-- includes_insurance=true 가 default_insurance_item_id 를 요구하는 규칙은
-- service-layer 검증으로 둔다. Slice B(insurance category/period)가 머지되기
-- 전까지는 seed/운영 데이터가 NULL 상태일 수 있고, 향후 컬럼이 nullable로
-- 유지되어야 하기 때문.

create index ix_contract_templates_category_active
    on contract_templates(category)
    where deleted_at is null;

-- The pre-existing 무제한 계약 system template stays as CUSTOM with NULL form
-- fields. The default value on `category` already covers it; this update pins
-- the audit timestamp to make the migration self-describing in history.
update contract_templates
set category = 'CUSTOM',
    updated_at = now()
where deleted_at is null
  and system_template = true;

-- Default package seed. UUIDs are deterministic so re-running the migration in
-- another environment lands the same primary keys (eases trace + diffing).
-- includes_insurance=true rows leave `default_insurance_item_id` NULL until
-- Slice B introduces the matching insurance items; the partial unique index on
-- name keeps duplicate seeds out, and `on conflict do nothing` makes the
-- insert idempotent if the rows already exist.
insert into contract_templates (
    id, name, duration_minutes, description, enabled, system_template,
    category, return_type, duration_unit, duration_value, includes_insurance,
    default_insurance_item_id, created_at, updated_at
) values
    ('11111111-1111-1111-1111-000000000001', '구독 인수형 12개월 (보험 포함)',          525600, '12개월 구독 / 인수형 / 보험 포함', true, false, 'SUBSCRIPTION', 'TAKEOVER', 'MONTH', 12, true,  null, now(), now()),
    ('11111111-1111-1111-1111-000000000002', '구독 인수형 12개월 (보험 미포함)',        525600, '12개월 구독 / 인수형 / 보험 미포함', true, false, 'SUBSCRIPTION', 'TAKEOVER', 'MONTH', 12, false, null, now(), now()),
    ('11111111-1111-1111-1111-000000000003', '구독 반납형 12개월 (보험 포함)',          525600, '12개월 구독 / 반납형 / 보험 포함', true, false, 'SUBSCRIPTION', 'RETURN',   'MONTH', 12, true,  null, now(), now()),
    ('11111111-1111-1111-1111-000000000004', '구독 반납형 12개월 (보험 미포함)',        525600, '12개월 구독 / 반납형 / 보험 미포함', true, false, 'SUBSCRIPTION', 'RETURN',   'MONTH', 12, false, null, now(), now()),
    ('11111111-1111-1111-1111-000000000005', '렌탈 인수형 (일 단위)',                   1440,  '단기 렌탈 / 인수형 / 일 단위', true, false, 'RENTAL', 'TAKEOVER', 'DAY',   1, false, null, now(), now()),
    ('11111111-1111-1111-1111-000000000006', '렌탈 반납형 (일 단위)',                   1440,  '단기 렌탈 / 반납형 / 일 단위', true, false, 'RENTAL', 'RETURN',   'DAY',   1, false, null, now(), now()),
    ('11111111-1111-1111-1111-000000000007', '렌탈 인수형 (월 단위)',                   43200, '중기 렌탈 / 인수형 / 월 단위', true, false, 'RENTAL', 'TAKEOVER', 'MONTH', 1, false, null, now(), now()),
    ('11111111-1111-1111-1111-000000000008', '렌탈 반납형 (월 단위)',                   43200, '중기 렌탈 / 반납형 / 월 단위', true, false, 'RENTAL', 'RETURN',   'MONTH', 1, false, null, now(), now())
on conflict do nothing;
