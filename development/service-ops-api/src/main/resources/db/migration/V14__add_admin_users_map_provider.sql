-- Per-admin choice of map provider for the /dashboard monitoring view.
-- Replaces the boolean `vworld_map_enabled` toggle that V13 dropped — the
-- operator now picks between two backends instead of flipping a single
-- vendor on/off. Default `VWORLD` keeps the post-V13 behaviour for every
-- existing admin; operators who prefer the legacy NAVER Cloud Platform
-- Maps SDK toggle to `NAVER` from the /settings page.

alter table admin_users
    add column map_provider varchar(16) not null default 'VWORLD';

alter table admin_users
    add constraint admin_users_map_provider_check
        check (map_provider in ('VWORLD', 'NAVER'));
