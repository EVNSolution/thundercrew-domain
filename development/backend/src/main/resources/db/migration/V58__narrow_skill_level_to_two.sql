-- 라이더 등급을 초보/고수 2단계로 축소. 중급은 판단 기준이 모호해 결국 안 쓰인다
-- (사용자 결정 2026-08-18).
--
-- 기존 INTERMEDIATE 는 **미판정(null)으로 되돌린다** — 2단계 체계에서 중급 판정은
-- 무효이고, 초보/고수 어느 쪽으로 추측해 옮기는 것보다 재판정 대상으로 두는 것이
-- 정직하다. 운영 데이터는 전원 미판정이라 실제 영향 0건(실측), 프리뷰 시드의
-- 중급 1건이 이 규칙의 실사용례다.
update riders set skill_level = null where skill_level = 'INTERMEDIATE';

alter table riders drop constraint ck_riders_skill_level;
alter table riders
    add constraint ck_riders_skill_level
        check (skill_level is null or skill_level in ('BEGINNER', 'EXPERT'));
