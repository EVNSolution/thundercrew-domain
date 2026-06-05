-- 차량·라이더 매칭 테스트용 분리 스키마 (추후 production 테이블과 합칠 예정)

create table test_vehicles (
    id           uuid         not null primary key,
    idx          bigserial    not null unique,
    plate_number varchar(50)  not null,
    bike_type    varchar(20)  not null,
    engine_type  varchar(20)  not null,
    imei         varchar(15),
    created_at   timestamptz  not null default now(),
    updated_at   timestamptz  not null default now(),
    deleted_at   timestamptz,
    created_by   uuid,
    updated_by   uuid,
    deleted_by   uuid
);

create unique index ux_test_vehicles_plate_number_active
    on test_vehicles(plate_number) where deleted_at is null;

create table test_riders (
    id                 uuid         not null primary key,
    idx                bigserial    not null unique,
    name               varchar(100) not null,
    phone_number       varchar(30)  not null,
    training_completed boolean      not null default false,
    team_name          varchar(100),
    created_at         timestamptz  not null default now(),
    updated_at         timestamptz  not null default now(),
    deleted_at         timestamptz,
    created_by         uuid,
    updated_by         uuid,
    deleted_by         uuid
);

create unique index ux_test_riders_phone_number_active
    on test_riders(phone_number) where deleted_at is null;

-- 매칭에는 중복 unique 제약 없음 — 의도적으로 중복을 허용해 validation 표시를 테스트함
create table test_matchings (
    id              uuid        not null primary key,
    idx             bigserial   not null unique,
    test_vehicle_id uuid        not null references test_vehicles(id) on delete restrict,
    service_type    varchar(30) not null,
    test_rider_id   uuid        not null references test_riders(id) on delete restrict,
    contract_type   varchar(20) not null,
    handover_type   varchar(20) not null,
    start_date      date        not null,
    end_date        date        not null,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    deleted_at      timestamptz,
    created_by      uuid,
    updated_by      uuid,
    deleted_by      uuid,
    constraint ck_test_matchings_end_after_start check (end_date > start_date)
);
