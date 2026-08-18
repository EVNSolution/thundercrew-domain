-- 이용자의 직무와 숙련도. 260804 미팅 요구사항 — "라이더/클리너 구분 + 초보/고수 등 기입".
--
-- 직무는 차량의 용도(V51)와 짝을 이루는 축이다. 배송용 차량에는 라이더가, 클린차량에는
-- 클리너가 붙는다. 다만 이 단계에서는 **서술 컬럼이다** — 배차 로직이 아직 직무로
-- 분기하지 않는다. 강제 규칙은 용도별 화면 분리가 들어올 때 붙인다.
--
-- 기본값을 RIDER 로 둔다. 현재 인력이 전원 배송 라이더이고, 클리너는 운영자가 화면에서
-- 지정한다. 용도(V51)와 달리 여기에는 복원할 이력 신호가 없다 — 직무 개념 자체가
-- 처음 들어오기 때문이다.
alter table riders
    add column role varchar(20) not null default 'RIDER';

alter table riders
    add constraint ck_riders_role
        check (role in ('RIDER', 'CLEANER'));

create index ix_riders_role_active
    on riders(role)
    where deleted_at is null;

-- 숙련도는 nullable 이다. "아직 판단하지 않았다"와 "초보다"는 다른 상태이고,
-- 기본값을 BEGINNER 로 두면 전원이 초보로 표시된다. 정비의 미점검과 같은 이유다.
alter table riders
    add column skill_level varchar(20);

alter table riders
    add constraint ck_riders_skill_level
        check (skill_level is null or skill_level in ('BEGINNER', 'INTERMEDIATE', 'EXPERT'));
