-- bike_next_customer 테이블에 현재 고객 컬럼 추가.
-- 기존 next 컬럼들은 promote() 후 null 이 될 수 있으므로 NOT NULL 제약을 제거.
ALTER TABLE bike_next_customer
  ADD COLUMN current_customer_name    VARCHAR(100)     NULL,
  ADD COLUMN current_customer_phone   VARCHAR(20)      NULL,
  ADD COLUMN current_customer_address VARCHAR(500)     NULL,
  ADD COLUMN current_customer_lat     DOUBLE PRECISION NULL,
  ADD COLUMN current_customer_lng     DOUBLE PRECISION NULL;

ALTER TABLE bike_next_customer
  ALTER COLUMN customer_name  DROP NOT NULL,
  ALTER COLUMN customer_phone DROP NOT NULL,
  ALTER COLUMN address        DROP NOT NULL,
  ALTER COLUMN latitude       DROP NOT NULL,
  ALTER COLUMN longitude      DROP NOT NULL;
