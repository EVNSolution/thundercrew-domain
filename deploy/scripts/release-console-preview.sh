#!/usr/bin/env bash
#
# 운영 콘솔 프리뷰 릴리스 교체. EC2 호스트에서 실행한다.
#
# 릴리스 디렉터리를 새로 만들고 `current` 심링크를 원자적으로 바꾼 뒤 두 유닛을
# 재시작한다. 실패하면 이전 릴리스가 그대로 남는다.
#
#   /opt/thundercrew-preview/releases/<release-id>
#   /opt/thundercrew-preview/current -> releases/<release-id>
#
# 사용법:
#   release-console-preview.sh <release-id> <staged-tree>
#   release-console-preview.sh rollback
#   release-console-preview.sh list
set -euo pipefail

ROOT=/opt/thundercrew-preview
RELEASES="${ROOT}/releases"
CURRENT="${ROOT}/current"
KEEP=3

API_UNIT=thundercrew-service-ops-api-preview
WEB_UNIT=thundercrew-front-admin-web-preview

log() { printf '[release-console-preview] %s\n' "$*"; }

ensure_layout() {
  sudo mkdir -p "${RELEASES}"
  sudo chown -R "$(id -un):$(id -gn)" "${ROOT}"
}

list_releases() {
  # 이름순 정렬. release-id 에 timestamp 를 앞세우므로 시간순이 된다.
  find "${RELEASES}" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' 2>/dev/null | sort
}

restart_units() {
  sudo systemctl daemon-reload
  sudo systemctl restart "${API_UNIT}"
  # 백엔드가 Flyway 로 프리뷰 DB 를 올리는 데 시간이 걸린다. 콘솔이 그 전에 떠도
  # 첫 요청이 실패할 뿐이지만, 확인 단계에서 오탐이 나지 않게 잠시 기다린다.
  sleep 10
  sudo systemctl restart "${WEB_UNIT}"
  sleep 5
  systemctl is-active "${API_UNIT}"
  systemctl is-active "${WEB_UNIT}"
}

case "${1:-}" in
  list)
    ensure_layout
    log "current -> $(readlink -f "${CURRENT}" 2>/dev/null || echo '(없음)')"
    list_releases
    exit 0
    ;;
  rollback)
    ensure_layout
    active="$(basename "$(readlink -f "${CURRENT}" 2>/dev/null || echo '')")"
    previous="$(list_releases | { grep -v -x -- "${active}" || true; } | tail -1)"
    if [ -z "${previous}" ]; then
      log "되돌릴 이전 릴리스가 없습니다."
      exit 1
    fi
    ln -sfn "${RELEASES}/${previous}" "${CURRENT}.tmp"
    mv -Tf "${CURRENT}.tmp" "${CURRENT}"
    restart_units
    log "rollback 완료: ${active} -> ${previous}"
    exit 0
    ;;
esac

RELEASE_ID="${1:?release-id 를 넘겨야 합니다}"
STAGED="${2:?staged-tree 를 넘겨야 합니다}"

# 최소 산출물 확인. 둘 중 하나만 있어도 프로세스는 뜨지만 즉시 죽는다.
if [ ! -f "${STAGED}/development/backend/build/libs/backend-0.0.1-SNAPSHOT.jar" ]; then
  log "백엔드 jar 이 없습니다: ${STAGED}/development/backend/build/libs/"
  exit 1
fi
if [ ! -d "${STAGED}/development/frontend/.next" ]; then
  log "Next.js 빌드 산출물이 없습니다: ${STAGED}/development/frontend/.next"
  exit 1
fi

ensure_layout
TARGET="${RELEASES}/${RELEASE_ID}"

if [ -e "${TARGET}" ]; then
  log "이미 있는 릴리스를 덮어씁니다: ${RELEASE_ID}"
  rm -rf "${TARGET}"
fi

# 완전한 릴리스를 먼저 만든 뒤 심링크를 바꾼다. 반쯤 복사된 트리로 프로세스가 뜨지 않게
# 하는 것이 핵심이다.
mkdir -p "${TARGET}"
cp -a "${STAGED}/." "${TARGET}/"

ln -sfn "${TARGET}" "${CURRENT}.tmp"
mv -Tf "${CURRENT}.tmp" "${CURRENT}"

restart_units

# 오래된 릴리스 정리. 현재 릴리스는 절대 지우지 않는다.
#
# grep 은 걸리는 줄이 없으면 1 을 반환하고 `set -o pipefail` 아래에서 그것이 스크립트를
# 죽인다. 첫 배포에서 반드시 그렇게 되므로 `|| true` 가 필요하다 — SPA 프리뷰 스크립트가
# 정확히 이 실수로 첫 배포마다 실패했다.
active="$(basename "$(readlink -f "${CURRENT}")")"
list_releases | { grep -v -x -- "${active}" || true; } | head -n -"${KEEP}" | while read -r stale; do
  [ -n "${stale}" ] || continue
  log "오래된 릴리스 삭제: ${stale}"
  rm -rf "${RELEASES}/${stale}"
done

log "릴리스 완료: ${RELEASE_ID}"
log "current -> $(readlink -f "${CURRENT}")"
