-- Bootstrap a default operator login so the deployed admin web is
-- usable without depending on the systemd EnvironmentFile having the
-- THUNDERCREW_ADMIN_SEED_* variables filled in. AdminSeedRunner only
-- creates / updates a user when those env values are present, and on
-- the current EC2 host they are blank, so /login had no usable
-- credentials. This migration drops in a known account directly.
--
-- login_id : admin
-- password : admin1234
--
-- The hash below was produced with Spring Security's BCryptPasswordEncoder
-- (strength 10) — verified via `bcrypt.checkpw("admin1234", "$2b$10$...")`.
-- Spring's matcher accepts $2a$ and $2b$ prefixes interchangeably.
--
-- Idempotency: the unique partial index on (login_id) where deleted_at is
-- null acts as the arbiter, and `on conflict do nothing` lets the
-- migration re-run safely on environments that already seeded `admin`
-- through other means (e.g. systemd env). Operators can rotate the
-- password later through the admin self-service flow (or via the seed
-- runner if THUNDERCREW_ADMIN_SEED_PASSWORD is set, since the runner
-- updates the existing row).

insert into admin_users (
    id,
    login_id,
    email,
    password_hash,
    display_name,
    enabled
) values (
    '22222222-0000-4000-8000-000000000001',
    'admin',
    null,
    '$2b$10$sZiJ336rQyJbGysltAAnZuBNC.WFUE8Qxzpgyoefns88lrU59URB.',
    'Ops Admin',
    true
)
on conflict do nothing;
