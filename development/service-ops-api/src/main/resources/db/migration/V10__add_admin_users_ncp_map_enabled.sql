-- Per-admin toggle for NCP Maps SDK loading on the dashboard. Replaces the
-- frontend hostname-based guard so an operator can flip the SDK on or off
-- from any browser/PC and have the choice survive across visits.
--
-- Default TRUE keeps every existing admin in the same observable state as
-- before this change rolls out (NCP loaded in production). Operators who
-- want to suppress NCP billing during low-traffic windows toggle the flag
-- to FALSE on the admin settings page.

alter table admin_users
    add column ncp_map_enabled boolean not null default true;
