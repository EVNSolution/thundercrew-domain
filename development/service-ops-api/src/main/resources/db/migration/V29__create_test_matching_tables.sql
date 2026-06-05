-- 차량·라이더 매칭 테스트용 분리 스키마 (추후 production 테이블과 합칠 예정)

CREATE TABLE test_vehicles (
    id          UUID             NOT NULL PRIMARY KEY,
    idx         BIGSERIAL        NOT NULL UNIQUE,
    plate_number VARCHAR(50)     NOT NULL,
    bike_type   VARCHAR(20)      NOT NULL,
    engine_type VARCHAR(20)      NOT NULL,
    imei        VARCHAR(15),
    created_at  TIMESTAMPTZ      NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ      NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ,
    created_by  UUID,
    updated_by  UUID,
    deleted_by  UUID
);

CREATE UNIQUE INDEX ux_test_vehicles_plate_number_active
    ON test_vehicles(plate_number) WHERE deleted_at IS NULL;

CREATE TABLE test_riders (
    id                 UUID         NOT NULL PRIMARY KEY,
    idx                BIGSERIAL    NOT NULL UNIQUE,
    name               VARCHAR(100) NOT NULL,
    phone_number       VARCHAR(30)  NOT NULL,
    training_completed BOOLEAN      NOT NULL DEFAULT false,
    team_name          VARCHAR(100),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ,
    created_by  UUID,
    updated_by  UUID,
    deleted_by  UUID
);

CREATE UNIQUE INDEX ux_test_riders_phone_number_active
    ON test_riders(phone_number) WHERE deleted_at IS NULL;

-- 매칭에는 중복 unique 제약 없음 — 의도적으로 중복을 허용해 validation 표시를 테스트함
CREATE TABLE test_matchings (
    id              UUID         NOT NULL PRIMARY KEY,
    idx             BIGSERIAL    NOT NULL UNIQUE,
    test_vehicle_id UUID         NOT NULL REFERENCES test_vehicles(id),
    service_type    VARCHAR(30)  NOT NULL,
    test_rider_id   UUID         NOT NULL REFERENCES test_riders(id),
    contract_type   VARCHAR(20)  NOT NULL,
    handover_type   VARCHAR(20)  NOT NULL,
    start_date      DATE         NOT NULL,
    end_date        DATE         NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ,
    created_by  UUID,
    updated_by  UUID,
    deleted_by  UUID
);
