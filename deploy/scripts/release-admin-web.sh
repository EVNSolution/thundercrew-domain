#!/usr/bin/env bash
#
# 새 관리자 웹(Vite SPA) 릴리스 교체. EC2 호스트에서 실행한다.
#
# DSV(`clever-dsv-web`) 규약을 따른다 — 릴리스 디렉터리를 새로 만들고
# `current` 심링크를 원자적으로 바꾼다. 실패하면 이전 릴리스가 그대로 남는다.
#
#   /srv/thundercrew-web/releases/<release-id>
#   /srv/thundercrew-web/current -> releases/<release-id>
#
# 사용법:
#   release-admin-web.sh <release-id> <build-dir>
#   release-admin-web.sh rollback            # 직전 릴리스로 되돌린다
#   release-admin-web.sh list                # 보관 중인 릴리스를 보여준다
set -euo pipefail

ROOT=/srv/thundercrew-web
RELEASES="${ROOT}/releases"
CURRENT="${ROOT}/current"
KEEP=5

log() { printf '[release-admin-web] %s\n' "$*"; }

ensure_layout() {
  sudo mkdir -p "${RELEASES}"
  sudo chown -R "$(id -un):$(id -gn)" "${ROOT}"
}

list_releases() {
  # 이름순 정렬. release-id 에 timestamp 를 앞세우므로 시간순이 된다.
  find "${RELEASES}" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' 2>/dev/null | sort
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
    previous="$(list_releases | grep -v -x -- "${active}" | tail -1 || true)"
    if [ -z "${previous}" ]; then
      log "되돌릴 이전 릴리스가 없습니다."
      exit 1
    fi
    ln -sfn "${RELEASES}/${previous}" "${CURRENT}.tmp"
    mv -Tf "${CURRENT}.tmp" "${CURRENT}"
    sudo nginx -t
    sudo systemctl reload nginx
    log "rollback 완료: ${active} -> ${previous}"
    exit 0
    ;;
esac

RELEASE_ID="${1:?release-id 를 넘겨야 합니다}"
BUILD_DIR="${2:?build-dir 를 넘겨야 합니다}"

if [ ! -f "${BUILD_DIR}/index.html" ]; then
  log "빌드 산출물이 아닙니다: ${BUILD_DIR}/index.html 이 없습니다."
  exit 1
fi

ensure_layout
TARGET="${RELEASES}/${RELEASE_ID}"

if [ -e "${TARGET}" ]; then
  log "이미 있는 릴리스를 덮어씁니다: ${RELEASE_ID}"
  rm -rf "${TARGET}"
fi

# 먼저 완전한 릴리스를 만든 뒤에 심링크를 바꾼다. 반쯤 복사된 상태가
# 서빙되지 않게 하는 것이 핵심이다.
mkdir -p "${TARGET}"
cp -a "${BUILD_DIR}/." "${TARGET}/"

ln -sfn "${TARGET}" "${CURRENT}.tmp"
mv -Tf "${CURRENT}.tmp" "${CURRENT}"

sudo nginx -t
sudo systemctl reload nginx

# 오래된 릴리스 정리. 현재 릴리스는 절대 지우지 않는다.
#
# grep 은 걸리는 줄이 없으면 1 을 반환한다. `set -o pipefail` 아래에서는 그것이
# 파이프라인 실패가 되어 스크립트를 죽인다 — 릴리스가 현재 것 하나뿐인 첫 배포에서
# 항상 일어난다. 심링크 교체와 reload 는 이미 끝난 뒤라 배포는 됐는데 워크플로만
# 빨갛게 되고, 뒤따르는 접속 확인이 실행되지 않는다. rollback 경로는 같은 grep 에
# `|| true` 가 붙어 있었고 여기만 빠져 있었다.
active="$(basename "$(readlink -f "${CURRENT}")")"
list_releases | { grep -v -x -- "${active}" || true; } | head -n -"${KEEP}" | while read -r stale; do
  [ -n "${stale}" ] || continue
  log "오래된 릴리스 삭제: ${stale}"
  rm -rf "${RELEASES}/${stale}"
done

log "릴리스 완료: ${RELEASE_ID}"
log "current -> $(readlink -f "${CURRENT}")"
