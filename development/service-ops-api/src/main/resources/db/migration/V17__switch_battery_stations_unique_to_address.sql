-- 스테이션 중복 방지 기준을 `name` → `address` 로 변경한다. /overview 등록
-- 다이얼로그가 운영자가 입력한 주소를 곧바로 station 의 식별 키로 쓰기 때문에
-- name 컬럼은 별도 라벨/별명 정도로만 의미가 남고, 실제 중복 판정의 무게추는
-- address 로 옮겨가는 게 자연스럽다.
--
-- 기존 부분 유니크 인덱스 (`name`) 를 제거하고 동일한 부분 조건(`deleted_at is null`)으로
-- `address` 에 새 유니크 인덱스를 건다. 소프트 삭제 row 는 인덱스에서 제외되므로
-- 한 번 지워진 주소를 동일 주소로 다시 등록할 수 있다 (기존 시맨틱 유지).

drop index if exists ux_battery_stations_name_active;

create unique index ux_battery_stations_address_active
    on battery_stations(address)
    where deleted_at is null;
