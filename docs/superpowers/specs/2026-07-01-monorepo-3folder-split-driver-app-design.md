# Monorepo 3-Folder Split + In-Repo Driver App — Design

- Date: 2026-07-01 KST
- Status: approved (design), pending spec review
- Scope: restructure `development/` into `backend` / `frontend` / `app`, and port the
  Expo/React Native driver app into `development/app` in-repo.

## Goal

1. Rename the two runtime slices to clean role names: `service-ops-api` → `backend`,
   `front-admin-web` → `frontend`.
2. Add a third runtime slice `development/app` holding the CLEVER driver app (Expo/RN),
   ported from `clever-driver-app@cc-rider-auth` (already wired to `/api/v1/rider/**`).
3. Do this without breaking the live EC2 deploy pipeline (push-to-`main` auto-deploy) or
   the host-provisioned systemd services.

## Context / current state

- Monorepo `thundercrew-domain`. Root is an npm-workspace orchestration layer; runtime
  slices live under `development/`.
- Prod runs on a single EC2 host (`i-0d4f75c35b80b25b9`, Ubuntu 24.04) via systemd + nginx.
  `.github/workflows/aws-ec2-deploy.yml` SSHes in on every push to `main`, `git reset --hard`s
  the repo under `/opt/thundercrew/current`, rebuilds both slices, and restarts systemd units.
- The driver app on branch `cc-rider-auth` is **already** rewired to thundercrew
  `/api/v1/rider/**` (5 slices: auth, dispatch list, dispatch actions+photo, my-vehicle, map).
  Porting is a **relocation**, not a rewrite. Upstream `clever-driver-app` continues to evolve
  (unmerged `cc-222`, `cc-224`); the in-repo copy is an accepted fork.

### The load-bearing coupling (why this is not a plain `git mv`)

The two systemd unit files live **only on the host** (not in the repo). They key off
**names**, not just folder paths:

- `thundercrew-front-admin-web.service`: `WorkingDirectory=/opt/thundercrew/current`
  (repo root), `ExecStart=/usr/bin/npm run start --workspace @thundercrew/front-admin-web -- -H 127.0.0.1 -p 3000`.
  → references the **npm package name**, not the folder. A folder rename alone does not touch it;
  renaming the npm package **breaks** it unless the unit is updated in lockstep.
- `thundercrew-service-ops-api.service`: `WorkingDirectory=/opt/thundercrew/current/development/service-ops-api`,
  `ExecStart=/usr/bin/java -jar /opt/thundercrew/current/development/service-ops-api/build/libs/service-ops-api-0.0.1-SNAPSHOT.jar`.
  → references the **folder path** (×2) and the **Gradle artifact name**
  (`service-ops-api-0.0.1-SNAPSHOT.jar`, from `rootProject.name`).

Therefore a blind `sed` on folder paths is insufficient/unsafe. The chosen mechanic is to
**version the unit files in the repo** and have the deploy install them — deterministic and reviewable.

## Target structure

```
development/
  backend/    <- git mv from service-ops-api  (Spring Boot / Gradle, Java 21)
  frontend/   <- git mv from front-admin-web   (Next.js; pkg @thundercrew/frontend)
  app/        <- NEW: Expo/RN driver app (out-of-workspace standalone package)
deploy/
  systemd/    <- NEW: versioned copies of the two host unit files
```

`docs/` stays where it is. Local control-plane dirs (`clever-agent-workspace/*`) unchanged.

## Identifier changes

| # | What | Old | New |
|---|------|-----|-----|
| 1 | Backend folder | `development/service-ops-api` | `development/backend` |
| 2 | Frontend folder | `development/front-admin-web` | `development/frontend` |
| 3 | App folder | — | `development/app` (new) |
| 4 | npm frontend package | `@thundercrew/front-admin-web` | `@thundercrew/frontend` |
| 5 | Gradle artifact | `rootProject.name = "service-ops-api"` → `service-ops-api-0.0.1-SNAPSHOT.jar` | `rootProject.name = "backend"` → `backend-0.0.1-SNAPSHOT.jar` |
| — | systemd unit *names* | `thundercrew-front-admin-web` / `thundercrew-service-ops-api` | **unchanged** |
| — | host env files | `/etc/thundercrew/front-admin-web.env`, `/etc/thundercrew/service-ops-api.env` | **unchanged** |
| — | host log paths | `/var/log/thundercrew/*.log` | **unchanged** |

Keeping the unit + env-file + log *names* stable means **zero host file renames**; only the
identifiers *inside* the units change, delivered via the versioned install.

## Load-bearing files to update (the real gates)

| File | Change |
|------|--------|
| `.github/workflows/aws-ec2-deploy.yml` | gradlew path (`development/backend`), `.env.local` path (`development/frontend`), `.next` path (`development/frontend`); add two `sudo install` unit steps before `daemon-reload` |
| `scripts/check-workspace-layout.mjs` | repoint all required paths to `backend`/`frontend`; pkg assertion → `@thundercrew/frontend`; add `development/app` assertions |
| `package.json` (root) | `workspaces` → `["development/frontend"]`; 6 script `--workspace` targets → `@thundercrew/frontend` |
| `development/frontend/package.json` | `name` → `@thundercrew/frontend` |
| `development/backend/settings.gradle.kts` | `rootProject.name = "backend"` |
| `package-lock.json` (root) | **regenerate** via `npm install` so `npm ci` on the host matches (new workspace path + package name) |
| `scripts/dev/seed-monitoring-fixtures.mjs` + `scripts/dev/README.md` | update path/name references |
| `WORKSPACE.md`, `repo-map.md`, `README.md` | update the slice table + top-level references; add `app` slice row |

**Doc-reference policy:** update load-bearing configs + top-level docs above. **Leave dated
archive specs/plans** under `docs/superpowers/{specs,plans}/` **as-is** — they record what was
true on their date. The layout guard + a clean build + a correct `aws-ec2-deploy.yml` are the
enforcement, not a global find-replace across ~1000 historical mentions.

## Versioned systemd units (exact contents)

`deploy/systemd/thundercrew-front-admin-web.service` — identical to host except the `--workspace` name:

```ini
[Unit]
Description=ThunderCrew front-admin-web
After=network.target thundercrew-service-ops-api.service
Wants=thundercrew-service-ops-api.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/thundercrew/current
EnvironmentFile=/etc/thundercrew/front-admin-web.env
ExecStart=/usr/bin/npm run start --workspace @thundercrew/frontend -- -H 127.0.0.1 -p 3000
Restart=always
RestartSec=5
StandardOutput=append:/var/log/thundercrew/front-admin-web.log
StandardError=append:/var/log/thundercrew/front-admin-web.err.log

[Install]
WantedBy=multi-user.target
```

`deploy/systemd/thundercrew-service-ops-api.service` — identical except folder path (×2) + jar name:

```ini
[Unit]
Description=ThunderCrew service-ops-api
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/thundercrew/current/development/backend
EnvironmentFile=/etc/thundercrew/service-ops-api.env
ExecStart=/usr/bin/java -jar /opt/thundercrew/current/development/backend/build/libs/backend-0.0.1-SNAPSHOT.jar
Restart=always
RestartSec=5
SuccessExitStatus=143
StandardOutput=append:/var/log/thundercrew/service-ops-api.log
StandardError=append:/var/log/thundercrew/service-ops-api.err.log

[Install]
WantedBy=multi-user.target
```

Deploy install step (inserted after the `.next` typecheck/build block, before the existing
`sudo systemctl daemon-reload`):

```bash
sudo install -m 644 deploy/systemd/thundercrew-service-ops-api.service /etc/systemd/system/thundercrew-service-ops-api.service
sudo install -m 644 deploy/systemd/thundercrew-front-admin-web.service /etc/systemd/system/thundercrew-front-admin-web.service
```

Idempotent: re-installing identical files is a no-op; `daemon-reload` picks up any change.
The `ubuntu` user already runs `sudo mkdir/install/tee/systemctl` in this script, so no new privilege.

### Deploy sequence on the cutover (push to `main`)

1. `git reset --hard <sha>` → folders are `backend`/`frontend` on disk; `deploy/systemd/*` present.
2. Build backend: `./development/backend/gradlew --project-dir development/backend --no-daemon clean bootJar -x test` → `development/backend/build/libs/backend-0.0.1-SNAPSHOT.jar`.
3. `npm ci` (root, workspace `development/frontend`) → `npm run lint` → write `development/frontend/.env.local` → `rm -rf development/frontend/.next` → `npm run typecheck` → `npm run build`.
4. `sudo install` both unit files → `sudo systemctl daemon-reload`.
5. `restart thundercrew-service-ops-api` → sleep 8 → `restart thundercrew-front-admin-web` → `reload nginx`.
6. `is-active` checks for both units + nginx + postgresql.

The app slice is **not** built or touched by this pipeline.

## `development/app` port

- Copy the `clever-driver-app@cc-rider-auth` **working tree** into `development/app`: `src/{api,app,domain,platform,release,ui}`, `App.tsx`, `app.json`, `eas.json`, `index.ts`, `package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.js`, `.env.example`, `.nvmrc`, `.editorconfig`, `.gitattributes`, `scripts/`, `README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `design.md`, `docs/`.
- **Exclude:** `.git/`, `node_modules/`, `.expo/`, `dist/`, `.dockerignore` (no-Docker rule), and the app's own `.github/` workflows (defer app CI — out of scope for v1).
- **Out of the npm workspace.** Root `workspaces` stays `["development/frontend"]`. The app keeps its own `package-lock.json` and is installed/built only via its own `npm ci` + EAS. EC2 `npm ci` never resolves RN/Expo deps.
- Keep `app.json` `slug`/`ios.bundleIdentifier`/`android.package` as-is (EAS project + store identity). `android.config.googleMaps.apiKey` stays empty — real key + EAS build are a separate follow-up (map render remains unverified until then).
- `package.json` `name` stays `clever-driver-app` (cosmetic; out-of-workspace). Its `postcss` override and `expo lint`/`tsc`/`node:test` scripts are self-contained.

## Sequencing

Single feature branch, two logical commits, PR into `dev`:

- **Commit A (additive, zero deploy risk):** add `development/app` + a `WORKSPACE.md`/`repo-map.md`
  slice row for it. Nothing existing moves.
- **Commit B (rename + units):** `git mv` both folders; update all load-bearing files; add
  `deploy/systemd/*`; regenerate root lockfile.

Merges to `dev` (self-authorized). The **risky cutover is the `dev → main` promotion**, which is
user-gated — that push is the first time the renamed layout + versioned units hit prod.

## Risks & rollback

- **Cutover window:** between `git reset --hard` (old folder gone) and the unit install+restart,
  the *running* old processes keep serving (in-memory), but `Restart=always` means a crash/reboot
  in that window could loop the old unit on a missing path. Mitigation: watch the cutover deploy to
  green; re-run to green closes it. (Standard for this pipeline.)
- **`npm ci` lockfile mismatch:** if the root `package-lock.json` isn't regenerated, on-host
  `npm ci` fails hard. Mitigation: regenerate + commit the lockfile in Commit B; a local `npm ci`
  dry-run gates it.
- **Rollback:** revert the promotion commit and push `main`; the deploy re-installs the *previous*
  versioned units (old names/paths) and rebuilds the old layout. Because units are now versioned,
  rollback is symmetric — no manual host edit. (First cutover only: the pre-existing host units
  already match the old identifiers, so a revert before any successful new deploy is a plain no-op.)

## Verification

- **Static (local, this repo):** `node scripts/check-workspace-layout.mjs` passes; `npm ci`
  (root) succeeds against regenerated lock; `npm run lint` + `npm run typecheck` + `npm run build`
  green from `development/frontend`; `./development/backend/gradlew --project-dir development/backend build -x test` produces `backend-0.0.1-SNAPSHOT.jar`.
- **App slice:** `cd development/app && npm ci && npm run typecheck && npm run lint` green (RN
  runtime/map render deferred to EAS build).
- **Deploy correctness (review, not run):** confirm every path/name in `aws-ec2-deploy.yml` and the
  two versioned units resolves against the new layout; jar filename matches `rootProject.name`.
- Prod runtime is validated by the gated `dev → main` cutover deploy's `is-active` checks +
  post-deploy HTTP smoke, per existing practice.

## Out of scope

- Android Google Maps API key + EAS build/store submission (separate follow-up).
- App CI workflows in-repo.
- Renaming systemd unit names, host env files, or log paths.
- Phase 2 web Slice B (completion/photo proxy route).
- Rewriting historical dated specs/plans references.
