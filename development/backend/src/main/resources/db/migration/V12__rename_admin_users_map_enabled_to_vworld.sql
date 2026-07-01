-- Rename the per-admin map-loading toggle from `ncp_map_enabled` to
-- `vworld_map_enabled` to match the new VWorld 2D Map provider. The
-- frontend dropped the NCP Naver Maps SDK in favour of VWorld; the
-- backend column was the only piece still carrying the legacy name.
--
-- Default + nullability are preserved by `rename column`, so this is a
-- pure rename (no data backfill, no downtime concern for a single-admin
-- dev backend). Pre-existing rows keep their TRUE/FALSE values.

alter table admin_users
    rename column ncp_map_enabled to vworld_map_enabled;
