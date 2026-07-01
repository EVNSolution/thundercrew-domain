-- Drop the per-admin map-loading toggle column. The frontend removed the
-- /settings UI and per-admin runtime gate; the dashboard always loads the
-- VWorld 2D Map SDK as long as `NEXT_PUBLIC_VWORLD_API_KEY` is set at
-- build time. Pre-existing TRUE/FALSE values are discarded — no operator
-- ever flipped this off in production.

alter table admin_users
    drop column vworld_map_enabled;
