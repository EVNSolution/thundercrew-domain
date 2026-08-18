#!/usr/bin/env bash
#
# 운영 콘솔 프리뷰의 호스트 사전 조건을 준비한다. EC2 호스트에서 한 번 실행한다.
#
#   1. 프리뷰 데이터베이스와 전용 사용자 생성
#   2. 백엔드·프론트 프리뷰 환경 파일 작성
#   3. 로그 디렉터리 준비
#
# **비밀값은 이 스크립트가 호스트에서 만든다.** 인자로 받지 않고 출력하지도 않는다 —
# 명령 이력, CI 로그, 대화 기록 어디에도 남지 않게 하는 것이 목적이다. 사람이 알아야 하는
# 관리자 비밀번호만 root 전용 파일에 남긴다.
#
# 멱등하다. 이미 있는 것은 건드리지 않고, 두 번 돌려도 비밀값이 바뀌지 않는다.
#
# 사용법:
#   sudo -n true                      # 무암호 sudo 확인
#   ./provision-console-preview.sh
#   ./provision-console-preview.sh --show-admin-path   # 관리자 자격증명 파일 위치만 출력
set -euo pipefail

ENV_DIR=/etc/thundercrew
API_ENV="${ENV_DIR}/service-ops-api-preview.env"
WEB_ENV="${ENV_DIR}/front-admin-web-preview.env"
ADMIN_FILE="${ENV_DIR}/preview-admin-credentials"

DB_NAME=thundercrew_preview
DB_USER=thundercrew_preview
API_PORT=8081
WEB_PORT=3100

log() { printf '[provision-console-preview] %s\n' "$*"; }

if [ "${1:-}" = "--show-admin-path" ]; then
  echo "${ADMIN_FILE}"
  exit 0
fi

# ── 0. 전제 확인 ────────────────────────────────────────────────────────────────
command -v psql >/dev/null || { log "psql 이 없습니다."; exit 1; }
sudo -n true 2>/dev/null || { log "무암호 sudo 가 필요합니다."; exit 1; }
systemctl is-active --quiet postgresql || { log "postgresql 이 실행 중이 아닙니다."; exit 1; }

# 운영 자격증명을 재사용하지 않는지 확인한다. 프리뷰가 운영 데이터에 닿을 경로를 아예
# 만들지 않는 것이 이 환경의 목적이다.
if [ -f "${ENV_DIR}/service-ops-api.env" ]; then
  prod_db="$(sudo grep -oP '(?<=^SPRING_DATASOURCE_URL=).*' "${ENV_DIR}/service-ops-api.env" || true)"
  case "${prod_db}" in
    *"/${DB_NAME}"*)
      log "운영 env 가 이미 ${DB_NAME} 을 가리킵니다. 이름이 겹칩니다 — 중단합니다."
      exit 1
      ;;
  esac
fi

sudo mkdir -p "${ENV_DIR}" /var/log/thundercrew
sudo chown ubuntu:ubuntu /var/log/thundercrew

# ── 1. 데이터베이스 ─────────────────────────────────────────────────────────────
db_exists() { sudo -u postgres psql -lqt | cut -d'|' -f1 | grep -qw "$1"; }
role_exists() { sudo -u postgres psql -tAc "select 1 from pg_roles where rolname='$1'" | grep -q 1; }

DB_PASSWORD=""
if role_exists "${DB_USER}"; then
  log "역할 ${DB_USER} 이 이미 있습니다. 비밀번호를 바꾸지 않습니다."
else
  # 32바이트 base64. 특수문자로 JDBC URL 이 깨지지 않게 영숫자만 남긴다.
  DB_PASSWORD="$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32)"
  sudo -u postgres psql -q -c "create user ${DB_USER} with password '${DB_PASSWORD}'"
  log "역할 ${DB_USER} 생성"
fi

if db_exists "${DB_NAME}"; then
  log "데이터베이스 ${DB_NAME} 이 이미 있습니다."
else
  sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
  log "데이터베이스 ${DB_NAME} 생성"
fi

sudo -u postgres psql -q -c "grant all privileges on database ${DB_NAME} to ${DB_USER}"
sudo -u postgres psql -q -d "${DB_NAME}" -c "grant all on schema public to ${DB_USER}"

# ── 2. 백엔드 환경 파일 ─────────────────────────────────────────────────────────
if sudo test -f "${API_ENV}"; then
  log "${API_ENV} 이 이미 있습니다. 건드리지 않습니다."
else
  if [ -z "${DB_PASSWORD}" ]; then
    log "역할은 있는데 env 파일이 없습니다. DB 비밀번호를 알 수 없어 env 를 만들 수 없습니다."
    log "  해결: sudo -u postgres psql -c \"alter user ${DB_USER} with password '<새 값>'\" 후"
    log "        ${API_ENV} 를 직접 작성하거나, 역할을 지우고 이 스크립트를 다시 실행하세요."
    exit 1
  fi
  JWT_SECRET="$(openssl rand -base64 48 | tr -d '\n')"
  ADMIN_PASSWORD="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 20)"

  sudo install -m 600 -o ubuntu -g ubuntu /dev/null "${API_ENV}"
  sudo tee "${API_ENV}" >/dev/null <<EOF_API
# 운영 콘솔 프리뷰 백엔드. 이 파일은 이 호스트에만 있고 저장소에 커밋되지 않는다.
# 생성: provision-console-preview.sh
#
# 키 이름은 application.properties 가 읽는 것과 정확히 같아야 한다. 처음에 이름을 짐작해서
# 썼다가 백엔드가 부팅에 실패했다 —
#   thundercrew.auth.jwt.secret must be provided with at least 32 bytes
# `THUNDERCREW_JWT_SECRET` 로 썼는데 앱은 `THUNDERCREW_AUTH_JWT_SECRET` 을 읽는다.
# 유닛은 `active` 로 보이고(systemd 가 재시작을 반복한다) 로그를 봐야 드러난다.
#
# 대조 대상: development/backend/src/main/resources/application.properties
# 그리고 운영의 /etc/thundercrew/service-ops-api.env 키 이름
SERVER_PORT=${API_PORT}
PREVIEW_DB_NAME=${DB_NAME}
SERVICE_OPS_DB_URL=jdbc:postgresql://127.0.0.1:5432/${DB_NAME}
SERVICE_OPS_DB_USERNAME=${DB_USER}
SERVICE_OPS_DB_PASSWORD=${DB_PASSWORD}
THUNDERCREW_AUTH_JWT_SECRET=${JWT_SECRET}
# 첫 부팅에 관리자 계정을 만든다. 이미 있으면 아무것도 하지 않는다(AdminSeedRunner).
THUNDERCREW_ADMIN_SEED_LOGIN_ID=preview-admin
THUNDERCREW_ADMIN_SEED_PASSWORD=${ADMIN_PASSWORD}
THUNDERCREW_ADMIN_SEED_DISPLAY_NAME=Preview Admin
EOF_API
  log "${API_ENV} 작성 (600)"

  # 사람이 알아야 하는 값만 root 전용 파일로 남긴다. 로그에는 찍지 않는다.
  sudo install -m 600 -o root -g root /dev/null "${ADMIN_FILE}"
  sudo tee "${ADMIN_FILE}" >/dev/null <<EOF_ADMIN
운영 콘솔 프리뷰 관리자 (http://<호스트>:8090/login)
  login-id: preview-admin
  password: ${ADMIN_PASSWORD}

이 파일은 root 만 읽을 수 있습니다. 비밀번호를 바꾸면 프리뷰 콘솔의 비밀번호 변경 흐름을
쓰세요 — env 의 값은 빈 DB 첫 부팅 시드에만 의미가 있습니다.
EOF_ADMIN
  log "관리자 자격증명을 ${ADMIN_FILE} 에 남겼습니다 (root 전용). 확인: sudo cat ${ADMIN_FILE}"
fi

# ── 3. 프론트 환경 파일 ─────────────────────────────────────────────────────────
if sudo test -f "${WEB_ENV}"; then
  log "${WEB_ENV} 이 이미 있습니다. 건드리지 않습니다."
else
  # 지도 키는 비밀이 아니라 클라이언트 노출값이다. 운영 env 에서 그대로 가져온다.
  map_lines=""
  if sudo test -f "${ENV_DIR}/front-admin-web.env"; then
    map_lines="$(sudo grep -E '^NEXT_PUBLIC_' "${ENV_DIR}/front-admin-web.env" || true)"
  fi
  sudo install -m 600 -o ubuntu -g ubuntu /dev/null "${WEB_ENV}"
  sudo tee "${WEB_ENV}" >/dev/null <<EOF_WEB
# 운영 콘솔 프리뷰 프론트. 이 파일은 이 호스트에만 있고 저장소에 커밋되지 않는다.
# 생성: provision-console-preview.sh
PORT=${WEB_PORT}
NODE_ENV=production
SERVICE_OPS_API_BASE_URL=http://127.0.0.1:${API_PORT}
# 프리뷰는 평문 HTTP 라 Secure 쿠키가 브라우저에 저장되지 않는다. 그러면 로그인 직후
# 화면은 보이지만 다음 요청부터 세션이 없어 /login 으로 되돌아간다.
# **운영 env 에는 절대 넣지 않는다.** 프리뷰에 TLS 를 붙이면 이 줄을 지운다.
SERVICE_OPS_COOKIE_INSECURE=true
${map_lines}
EOF_WEB
  log "${WEB_ENV} 작성 (600)"
  if [ -z "${map_lines}" ]; then
    log "경고: 운영 env 에서 NEXT_PUBLIC_* 를 찾지 못했습니다. 지도가 빈 키로 뜹니다."
  fi
fi

# ── 3.5 부팅 확인 ───────────────────────────────────────────────────────────────
# env 이름이 틀리면 유닛은 `active` 로 보이면서 재시작을 반복한다. 여기서 잡지 않으면
# 배포까지 끝난 뒤 로그인 화면에서야 드러난다.
if systemctl list-unit-files | grep -q '^thundercrew-service-ops-api-preview\.service'; then
  log "프리뷰 백엔드 부팅 확인"
  sudo systemctl restart thundercrew-service-ops-api-preview || true
  ok=0
  for _ in $(seq 1 20); do
    if ss -ltn | grep -q ":${API_PORT} "; then ok=1; break; fi
    sleep 3
  done
  if [ "${ok}" -eq 1 ]; then
    log "  127.0.0.1:${API_PORT} 응답 — 정상"
  else
    log "  ✕ ${API_PORT} 가 열리지 않았습니다. 로그를 보세요:"
    log "    sudo tail -40 /var/log/thundercrew/service-ops-api-preview.log"
    exit 1
  fi
else
  log "프리뷰 백엔드 유닛이 아직 없습니다. 배포 후 확인됩니다."
fi

# ── 4. 요약 ─────────────────────────────────────────────────────────────────────
log "완료. 준비 상태:"
sudo ls -l "${API_ENV}" "${WEB_ENV}" 2>/dev/null || true
printf '  database: '; db_exists "${DB_NAME}" && echo "${DB_NAME} ok" || echo "없음"
echo "  다음 단계: GitHub Actions 의 'AWS EC2 console preview deploy' 를 실행하세요."
echo "  메모리 여유(배포 preflight 가 900MiB 를 요구합니다):"
free -m | sed 's/^/    /'
