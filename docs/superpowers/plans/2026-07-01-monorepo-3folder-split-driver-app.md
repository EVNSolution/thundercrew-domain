# Monorepo 3-Folder Split + In-Repo Driver App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `development/` into `backend`/`frontend`/`app`, porting the Expo/RN driver app in-repo, without breaking the live EC2 push-to-`main` auto-deploy.

**Architecture:** Two commits on one feature branch → one PR into `dev`. Commit A is purely additive (port `development/app`, out of the npm workspace). Commit B atomically renames both existing slices and every load-bearing identifier that keys off their names (npm package, Gradle artifact, deploy paths), versions the two host systemd units in-repo so the deploy installs them, and regenerates the root lockfile. The risky prod cutover is the user-gated `dev → main` promotion.

**Tech Stack:** npm workspaces, Next.js 16 (frontend), Spring Boot 3.5 / Gradle Kotlin DSL / Java 21 (backend), Expo SDK 54 / React Native 0.81 (app), GitHub Actions + systemd + nginx on EC2.

---

## Working context

- **Repo:** `C:\Users\user\repositories\clever\thundercrew-domain` (its own git repo). Current branch: `cc-monorepo-3folder-split-driver-app` (off `dev`), already holds the design-spec commit.
- **App source:** `C:\Users\user\repositories\clever-driver-app` @ branch `cc-rider-auth` (clean, 124 tracked files). Read-only source — do NOT commit or push there.
- **Shell:** use the **Bash tool** (Git Bash) for all `git`/`tar`/`sed`/`grep` commands below. Paths are given in Git Bash form (`/c/Users/...`).
- **Spec:** `docs/superpowers/specs/2026-07-01-monorepo-3folder-split-driver-app-design.md`.

## File Structure (what each change touches)

Commit A creates:
- `development/app/**` — the ported Expo/RN app (standalone package, its own `package-lock.json`, its own nested `.gitignore`; **not** a workspace member).

Commit B creates/renames/modifies:
- `development/service-ops-api/` → `development/backend/` (`git mv`)
- `development/front-admin-web/` → `development/frontend/` (`git mv`)
- `development/backend/settings.gradle.kts` — `rootProject.name = "backend"` (artifact → `backend-0.0.1-SNAPSHOT.jar`)
- `development/frontend/package.json` — `name` → `@thundercrew/frontend`
- `package.json` (root) — `workspaces` path + 6 `--workspace` targets
- `package-lock.json` (root) — regenerated
- `scripts/check-workspace-layout.mjs` — layout guard rewritten for the new tree + app assertions
- `deploy/systemd/thundercrew-service-ops-api.service` — NEW (versioned unit, new folder path + jar name)
- `deploy/systemd/thundercrew-front-admin-web.service` — NEW (versioned unit, new `--workspace` name)
- `.github/workflows/aws-ec2-deploy.yml` — gradlew path, `.env.local` path, `.next` path, + `sudo install` unit steps
- `README.md`, `WORKSPACE.md`, `repo-map.md` — folder-path refs renamed + `app` slice documented

**Never touched:** systemd unit *names* (`thundercrew-service-ops-api`, `thundercrew-front-admin-web`), host env files (`/etc/thundercrew/*.env`), host log paths, the `SERVICE_OPS_API_BASE_URL` env var, "service-ops" prose tokens, and any dated file under `docs/superpowers/{specs,plans}/` other than this plan and its spec.

---

## Task 1: Port the driver app into `development/app` (Commit A — additive)

**Files:**
- Create: `development/app/**` (extracted from `clever-driver-app@cc-rider-auth`)

- [ ] **Step 1: Confirm the source ref is clean**

Run:
```bash
git -C /c/Users/user/repositories/clever-driver-app status --short
git -C /c/Users/user/repositories/clever-driver-app rev-parse --abbrev-ref HEAD
```
Expected: empty status output; branch prints `cc-rider-auth`. If not clean, STOP and report.

- [ ] **Step 2: Extract the tracked tree into `development/app`**

`git archive` emits only tracked files at the ref — it excludes `.git` and everything gitignored (`node_modules/`, `.expo/`, `dist/`). We then drop the two files the spec excludes (`.github/` app CI is deferred; `.dockerignore` violates the no-Docker rule). The app's own `.gitignore` is kept so its future `node_modules/.expo/dist` never get tracked by thundercrew-domain.

Run:
```bash
cd /c/Users/user/repositories/clever/thundercrew-domain
mkdir -p development/app
git -C /c/Users/user/repositories/clever-driver-app archive cc-rider-auth -o /tmp/clever-driver-app.tar
tar -xf /tmp/clever-driver-app.tar -C development/app
rm -f /tmp/clever-driver-app.tar
rm -rf development/app/.github development/app/.dockerignore
```

- [ ] **Step 3: Verify the extracted tree**

Run:
```bash
cd /c/Users/user/repositories/clever/thundercrew-domain
ls development/app
test -f development/app/package.json && test -f development/app/app.json && test -f development/app/eas.json && test -f development/app/.gitignore && echo "core files OK"
test ! -e development/app/.github && test ! -e development/app/.dockerignore && echo "excludes OK"
test ! -e development/app/.git && echo "no nested .git OK"
```
Expected: `development/app` lists `App.tsx app.json eas.json index.ts package.json package-lock.json src …`; all three `echo` lines print.

- [ ] **Step 4: Verify the app is OUT of the workspace and the root install is unaffected**

The root `package.json` still lists only `development/front-admin-web` as a workspace, so root `npm ci` must not descend into `development/app`.

Run:
```bash
cd /c/Users/user/repositories/clever/thundercrew-domain
npm ci
node scripts/check-workspace-layout.mjs
```
Expected: `npm ci` completes without installing React Native/Expo packages; layout check prints `Workspace layout check passed.` (the current guard still targets `front-admin-web`/`service-ops-api`, both still present — nothing renamed yet).

- [ ] **Step 5: Verify the app slice builds on its own toolchain**

Do NOT run `npm test` here — the app's `scripts/run-tests.mjs` has a known Windows `tsx.cmd EINVAL` bug. Typecheck + lint are the gates.

Run:
```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/app
npm ci
npm run typecheck
npm run lint
```
Expected: `tsc --noEmit` exits 0; `expo lint` exits 0.

- [ ] **Step 6: Commit A**

`development/app/node_modules` is ignored by the app's nested `.gitignore`, so `git add development/app` will not stage it. Confirm before committing.

Run:
```bash
cd /c/Users/user/repositories/clever/thundercrew-domain
git add development/app
git status --short | grep -c "development/app/node_modules" || true   # expect 0
git commit -m "$(cat <<'EOF'
feat: port clever-driver-app into development/app (additive)

Expo/RN driver app relocated from clever-driver-app@cc-rider-auth
(already rewired to /api/v1/rider/**). Standalone package: its own
package-lock.json + EAS toolchain, intentionally NOT a member of the
root npm workspace so EC2 `npm ci` never resolves React Native/Expo.
Excludes app-level .github CI (deferred) and .dockerignore (no Docker).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```
Expected: the grep prints `0`; commit succeeds.

---

## Task 2: Atomic rename + versioned units + config + docs + lockfile (Commit B)

**Why one commit:** a tree where the folders are renamed but `aws-ec2-deploy.yml` / the systemd units / the layout guard still point at the old names is broken. If such an intermediate state ever reached `main` it would break the auto-deploy. So every edit below lands in a **single commit** whose tree is verified green before committing. Do all edits, then run the whole verification block (Steps 12–17), then commit once (Step 18).

**Files:**
- Create: `development/backend/**`, `development/frontend/**` (via `git mv`)
- Create: `deploy/systemd/thundercrew-service-ops-api.service`, `deploy/systemd/thundercrew-front-admin-web.service`
- Modify: `development/backend/settings.gradle.kts`, `development/frontend/package.json`, `package.json`, `package-lock.json`, `scripts/check-workspace-layout.mjs`, `.github/workflows/aws-ec2-deploy.yml`, `README.md`, `WORKSPACE.md`, `repo-map.md`, plus path-form ref swap (Step 11, git-grep-driven) in `development/frontend/README.md`, `development/app/AGENTS.md`, `docs/backend/{00-change-ledger,01-prd-scope,03-scaffold-plan,04-open-questions,05-review-integration}.md`, `docs/process/framework-and-process.md`

- [ ] **Step 1: Rename the backend folder**

Run:
```bash
cd /c/Users/user/repositories/clever/thundercrew-domain
git mv development/service-ops-api development/backend
```

- [ ] **Step 2: Rename the Gradle root project (drives the jar filename)**

Set the entire content of `development/backend/settings.gradle.kts` to:
```kotlin
rootProject.name = "backend"
```

- [ ] **Step 3: Rename the frontend folder**

Run:
```bash
cd /c/Users/user/repositories/clever/thundercrew-domain
git mv development/front-admin-web development/frontend
```

- [ ] **Step 4: Rename the frontend npm package**

In `development/frontend/package.json`, change the `name` field only:
```json
  "name": "@thundercrew/frontend",
```
(Was `"@thundercrew/front-admin-web"`. Leave every other line unchanged.)

- [ ] **Step 5: Update the root `package.json`**

Set the entire content of `package.json` (repo root) to:
```json
{
  "name": "thundercrew-domain",
  "version": "0.1.0",
  "private": true,
  "workspaces": [
    "development/frontend"
  ],
  "scripts": {
    "dev": "npm run dev --workspace @thundercrew/frontend",
    "build": "npm run build --workspace @thundercrew/frontend",
    "start": "npm run start --workspace @thundercrew/frontend",
    "lint": "npm run lint --workspace @thundercrew/frontend",
    "test:service-ops": "npm run test:service-ops --workspace @thundercrew/frontend",
    "typecheck": "npm run typecheck --workspace @thundercrew/frontend",
    "check:workspace": "node scripts/check-workspace-layout.mjs",
    "dev:seed-monitoring": "node scripts/dev/seed-monitoring-fixtures.mjs"
  },
  "overrides": {
    "postcss": "^8.5.12"
  }
}
```

- [ ] **Step 6: Create the versioned backend systemd unit**

Create `deploy/systemd/thundercrew-service-ops-api.service` with exactly:
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

- [ ] **Step 7: Create the versioned frontend systemd unit**

Create `deploy/systemd/thundercrew-front-admin-web.service` with exactly:
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

- [ ] **Step 8: Rewrite the layout guard**

> Note: the guard's frontend anchor files are chosen to exist in the current tree. The old guard on `dev` asserted `app/dashboard/page.tsx` and `lib/services/mock-data.ts`, both since removed by codebase drift (dashboard is now `app/page.tsx`; `mock-data.ts` was split into per-domain service files) — so `check:workspace` has been red on `dev`. It never gated the deploy (`npm run build` does not chain it), which is why prod deploys fine. This rewrite uses live anchors (`app/page.tsx`, `lib/services/service-ops-api.ts`), so the guard goes green after the rename.

Set the entire content of `scripts/check-workspace-layout.mjs` to:
```js
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const required = [
  'development/frontend/package.json',
  'development/frontend/.env.example',
  'development/frontend/app/layout.tsx',
  'development/frontend/app/page.tsx',
  'development/frontend/components/layout/AppShell.tsx',
  'development/frontend/lib/services/service-ops-api.ts',
  'development/frontend/scripts/seed-admin.mjs',
  'development/frontend/types/domain.ts',
  'development/backend/build.gradle.kts',
  'development/app/package.json',
  'development/app/app.json',
  'development/app/eas.json',
  'deploy/systemd/thundercrew-front-admin-web.service',
  'deploy/systemd/thundercrew-service-ops-api.service',
  'README.md',
  'WORKSPACE.md',
  'repo-map.md',
];

const forbiddenRootFrontendDirs = ['app', 'components', 'lib', 'types'];
const forbiddenRootFrontendFiles = ['next.config.ts', 'tsconfig.json', 'eslint.config.mjs'];
const forbiddenRootFrontendArtifacts = ['.next', 'next-env.d.ts', 'tsconfig.tsbuildinfo'];
const failures = [];

for (const path of required) {
  if (!existsSync(join(root, path))) {
    failures.push(`missing required workspace path: ${path}`);
  }
}

for (const path of forbiddenRootFrontendDirs) {
  if (existsSync(join(root, path))) {
    failures.push(`frontend source directory must not live at repository root: ${path}/`);
  }
}

for (const path of forbiddenRootFrontendFiles) {
  if (existsSync(join(root, path))) {
    failures.push(`frontend config file must not live at repository root: ${path}`);
  }
}

for (const path of forbiddenRootFrontendArtifacts) {
  if (existsSync(join(root, path))) {
    failures.push(`stale frontend generated artifact must not live at repository root: ${path}`);
  }
}

const rootPackagePath = join(root, 'package.json');
if (existsSync(rootPackagePath)) {
  const rootPackage = JSON.parse(readFileSync(rootPackagePath, 'utf8'));
  const workspaces = rootPackage.workspaces ?? [];
  if (!workspaces.includes('development/frontend')) {
    failures.push('root package.json must declare development/frontend as a workspace');
  }
  if (workspaces.includes('development/app')) {
    failures.push('development/app must stay OUT of the npm workspace (own EAS lockfile/toolchain)');
  }
  for (const script of ['dev', 'lint', 'typecheck', 'build']) {
    if (!rootPackage.scripts?.[script]?.includes('@thundercrew/frontend')) {
      failures.push(`root npm script "${script}" must delegate to @thundercrew/frontend`);
    }
  }
}

const frontendPackagePath = join(root, 'development/frontend/package.json');
if (existsSync(frontendPackagePath)) {
  const frontendPackage = JSON.parse(readFileSync(frontendPackagePath, 'utf8'));
  if (frontendPackage.name !== '@thundercrew/frontend') {
    failures.push('frontend package.json must be named @thundercrew/frontend');
  }
  for (const script of ['dev', 'lint', 'typecheck', 'build']) {
    if (!frontendPackage.scripts?.[script]) {
      failures.push(`frontend package.json must expose "${script}" script`);
    }
  }
}

const appPackagePath = join(root, 'development/app/package.json');
if (existsSync(appPackagePath)) {
  const appPackage = JSON.parse(readFileSync(appPackagePath, 'utf8'));
  if (appPackage.name !== 'clever-driver-app') {
    failures.push('app package.json must keep name clever-driver-app');
  }
}

if (failures.length > 0) {
  console.error('Workspace layout check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Workspace layout check passed.');
```

- [ ] **Step 9: Update the deploy workflow — paths**

In `.github/workflows/aws-ec2-deploy.yml` make these three replacements.

Comment (near line 31):
```
      # `development/front-admin-web/.env.local` 로 흘려보내 줘야 한다. NCP Maps
```
→
```
      # `development/frontend/.env.local` 로 흘려보내 줘야 한다. NCP Maps
```

Gradle build (near line 161):
```
          ./development/service-ops-api/gradlew --project-dir development/service-ops-api --no-daemon clean bootJar -x test
```
→
```
          ./development/backend/gradlew --project-dir development/backend --no-daemon clean bootJar -x test
```

`.env.local` write (near line 170):
```
          cat > development/front-admin-web/.env.local <<EOF_ENV
```
→
```
          cat > development/frontend/.env.local <<EOF_ENV
```

`.next` wipe (near line 185):
```
          rm -rf development/front-admin-web/.next
```
→
```
          rm -rf development/frontend/.next
```

- [ ] **Step 10: Update the deploy workflow — install the versioned units before daemon-reload**

In `.github/workflows/aws-ec2-deploy.yml`, replace:
```
          sudo systemctl daemon-reload
          sudo systemctl restart thundercrew-service-ops-api
```
with:
```
          sudo install -m 644 deploy/systemd/thundercrew-service-ops-api.service /etc/systemd/system/thundercrew-service-ops-api.service
          sudo install -m 644 deploy/systemd/thundercrew-front-admin-web.service /etc/systemd/system/thundercrew-front-admin-web.service
          sudo systemctl daemon-reload
          sudo systemctl restart thundercrew-service-ops-api
```
(These lines sit inside the `<<'REMOTE'` heredoc at 10-space indentation — match it exactly. Re-installing identical unit files is a no-op; `daemon-reload` picks up any change. The `ubuntu` user already runs `sudo install`/`systemctl` in this script, so no new privilege.)

- [ ] **Step 11: Rename folder-path refs in the docs, then document the app slice**

Swap only the unambiguous **path form** `development/<folder>`; never touch bare `service-ops-api`/`front-admin-web` prose (those still name the systemd unit, the env file, the `SERVICE_OPS_API_BASE_URL` var, and "service-ops" session tokens).

Rather than a hand-maintained file list (which drifts and lets a stray ref slip past the Step 17 gate), drive the swap off `git grep`: rewrite every **tracked** file that contains a path-form ref, excluding only the frozen `docs/superpowers/` archives and the auto-generated `package-lock.json` (regenerated in Step 12). This runs AFTER the `git mv`s (Steps 1, 3), so the renamed frontend README (`development/frontend/README.md`) and the ported app doc (`development/app/AGENTS.md`) are matched at their new/tracked paths. Concretely it covers the top-level docs plus `docs/backend/*`, `docs/process/framework-and-process.md`, `development/frontend/README.md`, and `development/app/AGENTS.md`.

Run:
```bash
cd /c/Users/user/repositories/clever/thundercrew-domain
git grep -l -e 'development/front-admin-web' -e 'development/service-ops-api' \
  -- ':!**/docs/superpowers/**' ':!docs/superpowers/**' ':!package-lock.json' \
| while read -r f; do
    sed -i 's#development/front-admin-web#development/frontend#g; s#development/service-ops-api#development/backend#g' "$f"
  done
```

Then add the `app` slice to each top-level doc.

`WORKSPACE.md` — insert the app row after the backend row. Replace:
```
| `development/backend` | 운영 API, domain command/read contracts | Spring Boot / Java 21 |
```
with:
```
| `development/backend` | 운영 API, domain command/read contracts | Spring Boot / Java 21 |
| `development/app` | 라이더/드라이버 모바일 앱 (배차 수행·내 차량·지도) | Expo / React Native (Android+iOS) |
```

`repo-map.md` — insert an app section before the control-plane section. Replace:
```
## Local CLEVER control plane
```
with:
```
## App: `development/app`

- `src/` — Expo/React Native source (api, app, domain, platform, release, ui).
- `App.tsx`, `index.ts`, `app.json`, `eas.json` — Expo entry + build config.
- Standalone package (own `package-lock.json` + EAS toolchain); intentionally OUTSIDE the npm workspace so `npm ci` at the repo root never resolves React Native/Expo deps.

## Local CLEVER control plane
```

`README.md` — add the app bullet under the layout list. Replace:
```
- `development/backend` — Spring Boot 기반 운영 API
```
with:
```
- `development/backend` — Spring Boot 기반 운영 API
- `development/app` — Expo/React Native 라이더/드라이버 앱 (별도 EAS 빌드, npm workspace 제외)
```

- [ ] **Step 12: Regenerate the root lockfile**

The workspace path (`development/front-admin-web` → `development/frontend`) and package name changed, so the committed `package-lock.json` is stale. Regenerate with `npm install`, then prove it is in sync with `npm ci`.

Run:
```bash
cd /c/Users/user/repositories/clever/thundercrew-domain
npm install
npm ci
```
Expected: `npm install` rewrites `package-lock.json`; `npm ci` then completes with no "lockfile out of sync" error.

- [ ] **Step 13: Verify the layout guard passes on the new tree**

Run:
```bash
cd /c/Users/user/repositories/clever/thundercrew-domain
node scripts/check-workspace-layout.mjs
```
Expected: `Workspace layout check passed.`

- [ ] **Step 14: Verify the frontend builds under the new name**

Run:
```bash
cd /c/Users/user/repositories/clever/thundercrew-domain
npm run lint
npm run typecheck
npm run build
```
Expected: all three exit 0 (lint via `@thundercrew/frontend`, `tsc --noEmit`, `next build`).

- [ ] **Step 15: Verify the backend produces the renamed jar**

The systemd unit's `ExecStart` hard-references `backend-0.0.1-SNAPSHOT.jar`; confirm Gradle actually emits that filename.

Run:
```bash
cd /c/Users/user/repositories/clever/thundercrew-domain/development/backend
./gradlew --no-daemon clean bootJar -x test
ls build/libs/
```
Expected: `build/libs/` contains `backend-0.0.1-SNAPSHOT.jar`. (A `backend-0.0.1-SNAPSHOT-plain.jar` may also appear; the unit points at the non-plain boot jar, which is correct.)

- [ ] **Step 16: Verify the deploy workflow references only new paths + installs units**

Run:
```bash
cd /c/Users/user/repositories/clever/thundercrew-domain
grep -c "development/service-ops-api" .github/workflows/aws-ec2-deploy.yml    # expect 0
grep -c "development/front-admin-web" .github/workflows/aws-ec2-deploy.yml    # expect 0
grep -n "development/backend/gradlew" .github/workflows/aws-ec2-deploy.yml    # expect 1 line
grep -c "sudo install -m 644 deploy/systemd" .github/workflows/aws-ec2-deploy.yml  # expect 2
```
Expected: first two print `0`; third prints the gradlew line; fourth prints `2`.

- [ ] **Step 17: Verify no stray old path refs remain outside the archives**

Use `git grep` (tracked files only) so build artifacts (`.next/`, `build/`) and `node_modules/` are ignored automatically, and the check matches exactly what Step 11 swept.

Run:
```bash
cd /c/Users/user/repositories/clever/thundercrew-domain
git grep -n -e 'development/front-admin-web' -e 'development/service-ops-api' \
  -- ':!**/docs/superpowers/**' ':!docs/superpowers/**'
```
Expected: **no output.** The only tracked refs intentionally left are inside `docs/superpowers/` archives (frozen dated specs/plans). Any hit is a miss — fix it before committing. Note `package-lock.json` is *not* excluded here: if it still shows an old path, Step 12's regen didn't take — rerun `npm install`.

- [ ] **Step 18: Commit B (atomic)**

Run:
```bash
cd /c/Users/user/repositories/clever/thundercrew-domain
git add -A
git status --short
git commit -m "$(cat <<'EOF'
refactor!: rename development/ slices to backend + frontend; version systemd units

service-ops-api -> backend (Gradle rootProject.name -> backend, jar
backend-0.0.1-SNAPSHOT.jar), front-admin-web -> frontend (npm package
@thundercrew/frontend). Version the two host systemd units in-repo
(deploy/systemd) and have the EC2 deploy `sudo install` them before
daemon-reload, so the name changes stay provably safe. Unit names,
host env files, and log paths are unchanged. Root lockfile + layout
guard + deploy workflow + top-level docs updated. development/app
stays out of the workspace.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```
Expected: `git status --short` shows the renames as `R` (renamed) plus the new `deploy/systemd/` files and modified configs/docs; commit succeeds.

---

## Task 3: Final verification, push, and PR into `dev`

**Files:** none (integration + PR).

- [ ] **Step 1: Full green re-run on the committed tree**

Run:
```bash
cd /c/Users/user/repositories/clever/thundercrew-domain
npm ci
node scripts/check-workspace-layout.mjs
npm run lint
npm run typecheck
npm run build
( cd development/app && npm ci && npm run typecheck && npm run lint )
```
Expected: every command exits 0; layout check prints its pass line. (Backend jar was already verified in Task 2 Step 15.)

- [ ] **Step 2: Push the branch**

Run:
```bash
cd /c/Users/user/repositories/clever/thundercrew-domain
git push -u origin cc-monorepo-3folder-split-driver-app
```
Expected: branch pushes to `origin` (EVNSolution/thundercrew-domain). thundercrew-domain push access is confirmed working.

- [ ] **Step 3: Open the PR into `dev`**

Run:
```bash
cd /c/Users/user/repositories/clever/thundercrew-domain
gh pr create --base dev --head cc-monorepo-3folder-split-driver-app \
  --title "development/ 3-folder split (backend/frontend/app) + in-repo driver app" \
  --body "$(cat <<'EOF'
## Summary
- Port the Expo/RN driver app in-repo as `development/app` (from clever-driver-app@cc-rider-auth), kept OUT of the npm workspace (own EAS lockfile).
- Rename `service-ops-api` → `backend` (Gradle artifact `backend-0.0.1-SNAPSHOT.jar`) and `front-admin-web` → `frontend` (npm package `@thundercrew/frontend`).
- Version the two host systemd units in `deploy/systemd/` and install them from the EC2 deploy before `daemon-reload`. Unit names, host env files, and log paths unchanged.
- Update root `package.json` + lockfile, layout guard, `aws-ec2-deploy.yml`, and top-level docs.

## Sequencing
- Commit A: additive app port (zero deploy risk).
- Commit B: atomic rename + versioned units + config/docs + lockfile.

## Risk / cutover
The prod cutover is the **`dev → main` promotion** (user-gated). That push is the first time the renamed layout + versioned units reach the EC2 host — watch that deploy to green.

## Test Plan
- [ ] `npm ci` + `node scripts/check-workspace-layout.mjs` pass at root
- [ ] `npm run lint` / `typecheck` / `build` green (frontend)
- [ ] `development/backend` `bootJar` emits `backend-0.0.1-SNAPSHOT.jar`
- [ ] `development/app` `npm ci` + `typecheck` + `lint` green
- [ ] `aws-ec2-deploy.yml` references only new paths and installs both units
- [ ] no `development/front-admin-web` / `development/service-ops-api` refs outside `docs/superpowers/`
EOF
)"
```
Expected: PR is created against `dev`; note the URL.

- [ ] **Step 4: Hand off the cutover decision**

Report the PR URL. Per project policy, a verified feature PR to `dev` may be self-merged (`gh pr merge --merge --delete-branch`) after review; the **`dev → main` promotion stays user-gated** — that is the prod cutover and must be watched to green. Do not push `main`.

---

## Self-review (against the spec)

**Spec coverage:**
- 3-folder split → Task 2 Steps 1–5. ✅
- In-repo app port, out of workspace → Task 1 (+ guard assertion Task 2 Step 8). ✅
- Versioned systemd units + deploy installs them → Task 2 Steps 6–7, 10. ✅
- Identifier table (folder, npm pkg `@thundercrew/frontend`, jar `backend-…jar`; unit names/env/logs unchanged) → Steps 2, 4, 6–7; verified Step 15. ✅
- Load-bearing updates (deploy.yml, guard, root pkg, frontend pkg, settings.gradle, docs) → Steps 5, 8, 9, 11. ✅
- Root lockfile regeneration → Step 12. ✅
- Doc-ref policy (path-form only, archives untouched) → Step 11 + Step 17 guard. ✅
- One PR / two commits, dev merge, user-gated main cutover → Tasks 1–3. ✅

**Placeholder scan:** none — every code/config step shows full content; every command has expected output.

**Consistency:** `@thundercrew/frontend` appears identically in root `package.json` (Step 5), frontend `package.json` (Step 4), the frontend unit `ExecStart` (Step 7), and the guard (Step 8). `backend-0.0.1-SNAPSHOT.jar` matches between `settings.gradle.kts` (Step 2), the backend unit `ExecStart` (Step 6), and the jar-name verification (Step 15). Deploy gradlew `--project-dir development/backend` (Step 9) matches the renamed folder (Step 1).
