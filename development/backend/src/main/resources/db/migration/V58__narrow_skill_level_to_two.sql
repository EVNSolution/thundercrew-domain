-- 라이더 등급을 초보/고수 2단계로 축소. 중급은 판단 기준이 모호해 결국 안 쓰인다
-- (사용자 결정 2026-08-18). 운영 데이터는 전원 미판정(null)이라 값 이관이 없다 —
-- 운영 실측 후 확정한 사실이므로, INTERMEDIATE 행이 있으면 이 마이그레이션은
-- 제약 위반으로 실패한다(조용한 데이터 손실보다 낫다).
alter table riders drop constraint ck_riders_skill_level;
alter table riders
    add constraint ck_riders_skill_level
        check (skill_level is null or skill_level in ('BEGINNER', 'EXPERT'));
