create table maintenance_item_categories (
    maintenance_item_id uuid not null references maintenance_items(id),
    category varchar(40) not null,
    primary key (maintenance_item_id, category)
);
-- 그룹 헤더(부모) 행 소프트삭제 — 계층 제거로 무의미
update maintenance_items set deleted_at = now()
 where deleted_at is null
   and id in (select distinct parent_item_id from maintenance_items where parent_item_id is not null);
-- 기존 2축 → 4분류 교차곱 백필 (live 행만)
insert into maintenance_item_categories (maintenance_item_id, category)
 select id, 'TWO_WHEEL_ELECTRIC' from maintenance_items
  where deleted_at is null and applies_to in ('ELECTRIC','BOTH') and applies_to_wheel in ('TWO_WHEEL','BOTH');
insert into maintenance_item_categories (maintenance_item_id, category)
 select id, 'TWO_WHEEL_ICE' from maintenance_items
  where deleted_at is null and applies_to in ('ICE','BOTH') and applies_to_wheel in ('TWO_WHEEL','BOTH');
insert into maintenance_item_categories (maintenance_item_id, category)
 select id, 'FOUR_WHEEL_ELECTRIC' from maintenance_items
  where deleted_at is null and applies_to in ('ELECTRIC','BOTH') and applies_to_wheel in ('FOUR_WHEEL','BOTH');
insert into maintenance_item_categories (maintenance_item_id, category)
 select id, 'FOUR_WHEEL_ICE' from maintenance_items
  where deleted_at is null and applies_to in ('ICE','BOTH') and applies_to_wheel in ('FOUR_WHEEL','BOTH');
-- 구 컬럼 제거 (Postgres: 컬럼 drop이 관련 check/FK 자동 제거)
alter table maintenance_items drop column applies_to;
alter table maintenance_items drop column applies_to_wheel;
alter table maintenance_items drop column parent_item_id;
alter table maintenance_items drop column cycle_label;
alter table maintenance_items drop column display_order;
alter table maintenance_items drop column enabled;
