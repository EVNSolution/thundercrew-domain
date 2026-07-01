-- 휠 축 추가. 기존 항목은 기본 'BOTH'(전 휠 적용). add-column + check 동시 —
-- 기존 행이 모두 default 'BOTH' 라 check 위반 없음(값-재브랜드 아님).
alter table maintenance_items
    add column applies_to_wheel varchar(20) not null default 'BOTH';

alter table maintenance_items
    add constraint ck_maintenance_items_applies_to_wheel
        check (applies_to_wheel in ('TWO_WHEEL', 'FOUR_WHEEL', 'BOTH'));
