-- Drop the per-admin map provider preference. The frontend simplified
-- back to a single NAVER Cloud Platform Maps integration; the /settings
-- selector that V14 supported was removed along with the surrounding
-- admin-preferences endpoint, repository, and DTOs. Pre-existing values
-- are discarded.

alter table admin_users
    drop constraint if exists admin_users_map_provider_check;

alter table admin_users
    drop column map_provider;
