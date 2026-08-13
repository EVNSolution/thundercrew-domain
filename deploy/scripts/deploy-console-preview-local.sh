#!/usr/bin/env bash
#
# 운영 콘솔 프리뷰를 **로컬에서 직접** 배포한다. GitHub Actions 를 거치지 않는다.
#
# 하는 일은 `aws-ec2-console-preview-deploy.yml` 과 같다 — 빌드, preflight, 원자적 릴리스
# 교체, 확인. 다른 것은 당신의 SSH 키로 당신의 PC 에서 돈다는 점뿐이다. QA 반복이 잦을 때
# 워크플로 큐를 기다리지 않으려고 둔다.
#
# **프리뷰 전용이다.** 운영 유닛(thundercrew-service-ops-api, thundercrew-front-admin-web),
# 운영 nginx server block, 운영 DB 를 건드리지 않는다. 운영 배포는 `main` push →
# `aws-ec2-deploy.yml` 경로를 그대로 쓴다 — 그쪽은 PR CI 게이트를 지나야 하기 때문이다.
#
# 사용법:
#   export TC_SSH_KEY=~/.ssh/thundercrew-2026-08
#   export TC_HOST=3.35.123.221
#   ./deploy/scripts/deploy-console-preview-local.sh
#
#   ./deploy/scripts/deploy-console-preview-local.sh --skip-build   # 직전 빌드 산출물 재사용
#   ./deploy/scripts/deploy-console-preview-local.sh --rollback     # 직전 릴리스로
set -euo pipefail

SSH_KEY="${TC_SSH_KEY:-$HOME/.ssh/thundercrew-2026-08}"
HOST="${TC_HOST:-}"
USER_NAME="${TC_SSH_USER:-ubuntu}"
PREVIEW_PORT=8090
PREVIEW_API_PORT=8081

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${REPO_ROOT}"

SKIP_BUILD=0
ROLLBACK=0
for arg in "$@"; do
  case "${arg}" in
    --skip-build) SKIP_BUILD=1 ;;
    --rollback) ROLLBACK=1 ;;
    -h|--help) sed -n '2,25p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "알 수 없는 인자: ${arg}"; exit 2 ;;
  esac
done

log() { printf '\n\033[1m▶ %s\033[0m\n' "$*"; }
die() { printf '\n\033[31m✕ %s\033[0m\n' "$*" >&2; exit 1; }

[ -n "${HOST}" ] || die "TC_HOST 를 지정하세요 (예: export TC_HOST=3.35.123.221)"
[ -f "${SSH_KEY}" ] || die "SSH 키가 없습니다: ${SSH_KEY}"

SSH="ssh -i ${SSH_KEY} -o ConnectTimeout=10 ${USER_NAME}@${HOST}"

# ── 롤백 ────────────────────────────────────────────────────────────────────────
if [ "${ROLLBACK}" -eq 1 ]; then
  log "직전 릴리스로 롤백"
  ${SSH} '/opt/thundercrew-preview/bin/release-console-preview.sh rollback'
  exit 0
fi

# ── 0. 접속과 사전 조건 ─────────────────────────────────────────────────────────
log "접속 확인"
${SSH} 'echo "  연결됨: $(whoami)@$(hostname)"' || die "SSH 접속 실패. 공개키가 등록됐는지 확인하세요 (Actions 의 'AWS EC2 authorize SSH key')."

log "호스트 사전 조건 (여기서 멈추면 호스트는 그대로입니다)"
${SSH} "PREVIEW_API_PORT='${PREVIEW_API_PORT}' bash -s" <<'REMOTE'
set -euo pipefail
avail="$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)"
echo "  MemAvailable: ${avail} MiB"
if [ "${avail}" -lt 900 ]; then
  echo "  ✕ 900MiB 미만입니다. 프리뷰를 띄우면 운영 프로세스가 위험합니다." >&2
  exit 1
fi
for f in /etc/thundercrew/service-ops-api-preview.env /etc/thundercrew/front-admin-web-preview.env; do
  [ -f "$f" ] || { echo "  ✕ $f 이 없습니다. provision-console-preview.sh 를 먼저 실행하세요." >&2; exit 1; }
done
db="$(grep -oP '(?<=^PREVIEW_DB_NAME=).*' /etc/thundercrew/service-ops-api-preview.env || true)"
if [ -n "${db}" ]; then
  sudo -u postgres psql -lqt | cut -d'|' -f1 | grep -qw "${db}" \
    || { echo "  ✕ 프리뷰 DB ${db} 가 없습니다." >&2; exit 1; }
  echo "  프리뷰 DB: ${db}"
fi
echo "  사전 조건 통과"
REMOTE

# ── 1. 빌드 ─────────────────────────────────────────────────────────────────────
if [ "${SKIP_BUILD}" -eq 1 ]; then
  log "빌드 생략 (--skip-build). 직전 산출물을 씁니다."
  [ -f development/backend/build/libs/backend-0.0.1-SNAPSHOT.jar ] || die "백엔드 jar 이 없습니다. --skip-build 없이 실행하세요."
  [ -d development/frontend/.next ] || die "Next.js 산출물이 없습니다. --skip-build 없이 실행하세요."
else
  log "백엔드 빌드"
  ./development/backend/gradlew --project-dir development/backend --no-daemon clean bootJar -x test

  log "콘솔 타입체크 · 빌드"
  npm run typecheck
  npm run build
fi

# ── 2. 패키징 ───────────────────────────────────────────────────────────────────
# release-id 에 커밋과 dirty 여부를 남긴다. 로컬 배포는 작업 트리를 그대로 올릴 수 있으므로
# 호스트에 무엇이 올라갔는지 나중에 알 수 있어야 한다.
SHA="$(git rev-parse --short=12 HEAD)"
DIRTY=""
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  DIRTY="-dirty"
  printf '\n\033[33m⚠ 커밋되지 않은 변경이 있습니다. release-id 에 -dirty 를 남깁니다.\033[0m\n'
fi
RELEASE_ID="$(date -u +%Y%m%dT%H%M%SZ)-${SHA}${DIRTY}"

log "패키징 (${RELEASE_ID})"
TARBALL="$(mktemp -t console-preview-XXXXXX.tgz)"
trap 'rm -f "${TARBALL}"' EXIT
tar -czf "${TARBALL}" \
  package.json package-lock.json \
  node_modules \
  development/frontend/.next \
  development/frontend/package.json \
  development/frontend/public \
  development/backend/build/libs
ls -lh "${TARBALL}" | awk '{print "  "$5"  "$9}'

# ── 3. 전송 ─────────────────────────────────────────────────────────────────────
log "전송"
scp -q -i "${SSH_KEY}" \
  "${TARBALL}" \
  deploy/nginx/thundercrew-console-preview.conf \
  deploy/systemd/thundercrew-service-ops-api-preview.service \
  deploy/systemd/thundercrew-front-admin-web-preview.service \
  deploy/scripts/release-console-preview.sh \
  "${USER_NAME}@${HOST}:/tmp/"
${SSH} "mv /tmp/$(basename "${TARBALL}") /tmp/console-preview.tgz"

# ── 4. 설치와 교체 ──────────────────────────────────────────────────────────────
log "설치 · 릴리스 교체 · 확인"
${SSH} "RELEASE_ID='${RELEASE_ID}' PREVIEW_PORT='${PREVIEW_PORT}' bash -s" <<'REMOTE'
set -euo pipefail

sudo mkdir -p /var/log/thundercrew

sudo install -m 644 /tmp/thundercrew-service-ops-api-preview.service \
  /etc/systemd/system/thundercrew-service-ops-api-preview.service
sudo install -m 644 /tmp/thundercrew-front-admin-web-preview.service \
  /etc/systemd/system/thundercrew-front-admin-web-preview.service

# 예전 SPA 프리뷰 블록이 남아 있으면 내린다. 같은 8090 을 쓰고, 그 블록이 `/api/` 를
# 프록시해서 인증 없는 텔레메트리 주입 경로를 열어뒀다.
if [ -L /etc/nginx/sites-enabled/thundercrew-web-preview.conf ]; then
  echo "  예전 SPA 프리뷰 server block 을 내립니다."
  sudo rm -f /etc/nginx/sites-enabled/thundercrew-web-preview.conf
fi
sudo install -m 644 /tmp/thundercrew-console-preview.conf \
  /etc/nginx/sites-available/thundercrew-console-preview.conf
sudo ln -sfn /etc/nginx/sites-available/thundercrew-console-preview.conf \
  /etc/nginx/sites-enabled/thundercrew-console-preview.conf

staging="$(mktemp -d)"
tar -C "${staging}" -xzf /tmp/console-preview.tgz

sudo mkdir -p /opt/thundercrew-preview/bin
sudo install -m 755 /tmp/release-console-preview.sh \
  /opt/thundercrew-preview/bin/release-console-preview.sh
/opt/thundercrew-preview/bin/release-console-preview.sh "${RELEASE_ID}" "${staging}"

rm -rf "${staging}" /tmp/console-preview.tgz

sudo nginx -t
sudo systemctl reload nginx

code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PREVIEW_PORT}/")"
echo "  프리뷰 :${PREVIEW_PORT} -> ${code}"
case "${code}" in
  200|307|302) ;;
  *) echo "  ✕ 프리뷰가 응답하지 않습니다 (${code})" >&2; exit 1 ;;
esac

# 백엔드가 프리뷰 포트로 노출되지 않았는지 확인한다. 열려 있으면 인증 없는 텔레메트리
# 주입 경로가 다시 생긴다.
#
# 응답 코드로 판정하면 안 된다. Next.js 가 `/api/*` 를 자기 라우트로 갖고 있고 미들웨어가
# 401 이나 307 을 낸다 — 처음에 401 을 백엔드 신호로 봤다가 오탐이 났다. nginx 설정을
# 직접 본다.
if grep -qE 'proxy_pass\s+https?://127\.0\.0\.1:(8080|8081)'      /etc/nginx/sites-enabled/thundercrew-console-preview.conf; then
  echo "  ✕ 프리뷰 nginx 블록이 백엔드로 프록시하고 있습니다" >&2
  exit 1
fi
echo "  백엔드 프록시 없음 (nginx 설정 확인)"
# Server Action 이 동작할 조건을 확인한다. Next.js 는 `x-forwarded-host` 와 `origin` 을
# 대조하는데, `proxy_set_header Host $host` 는 포트를 빼서 비표준 포트에서 불일치가 난다.
# 로그인이 Server Action 이라 이게 틀리면 **화면은 뜨는데 로그인 버튼이 server error** 다.
# `GET /login` 200 만으로는 잡히지 않아서 실제로 놓쳤다.
if ! grep -qE 'proxy_set_header\s+Host\s+\$http_host\s*;'      /etc/nginx/sites-enabled/thundercrew-console-preview.conf; then
  echo "  ✕ 프리뷰 nginx 가 Host 를 \$http_host 로 넘기지 않습니다. Server Action 이 막힙니다." >&2
  exit 1
fi
echo "  Host 헤더에 포트 포함 (Server Action 조건 충족)"


# 운영이 그대로 살아 있는지 확인한다. 이 스크립트는 운영을 건드리지 않지만, 프리뷰가
# 메모리를 먹어 운영이 죽는 상황은 가능하다.
echo "  운영 상태:"
for unit in nginx thundercrew-service-ops-api thundercrew-front-admin-web postgresql; do
  printf '    %-38s %s\n' "${unit}" "$(systemctl is-active "${unit}")"
done
echo "  배포 후 메모리:"
free -m | sed 's/^/    /'
REMOTE

log "완료"
printf '  주소:    http://%s:%s/\n' "${HOST}" "${PREVIEW_PORT}"
printf '  릴리스:  %s\n' "${RELEASE_ID}"
printf '  데이터:  프리뷰 DB (운영과 분리)\n'
printf '  롤백:    %s --rollback\n' "$0"
