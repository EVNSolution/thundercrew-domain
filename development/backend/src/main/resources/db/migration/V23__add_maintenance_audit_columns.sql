-- V22 가 정비 두 테이블을 만들 때 audit 컬럼 중 `created_by` / `updated_by` 두
-- 개를 빠뜨려서 Hibernate schema-validation 이 startup 시 실패했다 (entity 의
-- `AuditableEntity` 슈퍼클래스는 두 컬럼을 기대). 핫픽스로 두 테이블에 nullable
-- UUID 컬럼을 더한다.
--
-- 시스템 계정이 record 를 만드는 경로(seed / 자동 작업) 가 있어 nullable 로
-- 둔다. 기존 행은 null 로 채워지고, 새 row 는 @PrePersist 가 채워주는 것이
-- 운영자 UUID 일 때만 값이 박힌다.

alter table maintenance_items
    add column created_by uuid,
    add column updated_by uuid;

alter table vehicle_maintenance_records
    add column created_by uuid,
    add column updated_by uuid;
