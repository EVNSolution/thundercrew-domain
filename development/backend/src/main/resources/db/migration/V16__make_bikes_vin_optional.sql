-- Make `bikes.vin` optional so the /overview vehicle-register dialog can
-- create rows without forcing the operator to know the VIN up-front. The
-- partial unique index on (vin) where deleted_at is null keeps its
-- duplicate-prevention guarantee for real VINs; PostgreSQL treats NULL
-- entries as distinct under unique indexes, so multiple "unknown VIN"
-- bikes coexist safely.

alter table bikes
    alter column vin drop not null;
