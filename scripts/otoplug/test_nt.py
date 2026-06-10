"""
OTOPLUG NT (Notification) 패턴 테스트
사용법:
  python3 test_nt.py register                  -> NT 전체 등록
  python3 test_nt.py register <keyword>        -> 특정 API 1개 등록
  python3 test_nt.py list                      -> 등록 목록 확인
  python3 test_nt.py unregister <keyword>      -> 특정 API 1개 해제
  python3 test_nt.py unregister-all            -> 전체 해제
  python3 test_nt.py watch                     -> 전체 로그 실시간 출력
  python3 test_nt.py watch <keyword>           -> 특정 NT 로그만 출력 (driving / device / drivingDetail / driving-result)

  keyword 는 api 이름 일부 (단, 1개만 매칭돼야 함)
  예) register status.data.driving   register result.data   register device   register drivingDetail

환경변수 (test_rr.py 와 동일):
  SERVER_URL    예) https://otoplug.kt.com
  CLIENT_ID     발급받은 client id
  SECURED_CODE  발급받은 secured code
"""
import os, sys, requests, uuid, json, time

NT_APIS = [
    'csi.terminal.status.data.driving',       # 주행 상태 (주기적)
    'csi.terminal.result.data.driving',        # 트립 종료 요약
    'csi.terminal.status.info.device',         # 디바이스 부팅 정보
    'csi.terminal.status.data.drivingDetail',    # FMS 실시간 5~10초
]

SERVER_URL   = os.environ['SERVER_URL']
CLIENT_ID    = os.environ['CLIENT_ID']
SECURED_CODE = os.environ['SECURED_CODE']
BASE_CALLBACK = 'https://thcr.cleversystem.ai/otoplug-test'
CALLBACKS = {
    'csi.terminal.status.data.driving':       f'{BASE_CALLBACK}/driving',
    'csi.terminal.result.data.driving':        f'{BASE_CALLBACK}/driving-result',
    'csi.terminal.status.info.device':         f'{BASE_CALLBACK}/device',
    'csi.terminal.status.data.drivingDetail':  f'{BASE_CALLBACK}/driving-detail',
}   # RR 과 동일
STATE_FILE   = '/tmp/otoplug_nt_state.json'

CMD     = sys.argv[1] if len(sys.argv) > 1 else ''
KEYWORD = sys.argv[2] if len(sys.argv) > 2 else None

if CMD not in ('register', 'list', 'unregister', 'unregister-all', 'watch'):
    print(__doc__)
    sys.exit(1)


def resolve_one(keyword: str, pool: list, label: str) -> dict:
    """pool 에서 keyword 로 1개만 매칭, 0개/2개+ 이면 에러
    정확히 일치하는 항목이 있으면 substring 매칭보다 우선"""
    exact = [e for e in pool if e[label] == keyword]
    if len(exact) == 1:
        return exact[0]
    matches = [e for e in pool if keyword in e[label]]
    if len(matches) == 1:
        return matches[0]
    if len(matches) == 0:
        print(f'[ERROR] "{keyword}" 매칭 없음')
        print(f'  {label} 목록: {[e[label] for e in pool]}')
    else:
        print(f'[ERROR] "{keyword}" 가 {len(matches)}개 매칭 — 더 구체적으로 입력하세요')
        for m in matches:
            print(f'  {m[label]}')
    sys.exit(1)

# ── Auth (test_rr.py 와 동일한 2단계 흐름) ───────────────────────────────────
r1 = requests.get(
    f"{SERVER_URL}/ccgf/v1/common.auth/"
    f"?clientID={CLIENT_ID}&securedCode={SECURED_CODE}&sessionID={uuid.uuid4()}",
    timeout=15)
r1.raise_for_status()
ac = r1.json()['authorizeCode']

r2 = requests.post(f"{SERVER_URL}/ccgf/v1/common.auth.token",
    json={'clientID': CLIENT_ID, 'authorizeCode': ac, 'redirectURI': None},
    timeout=15)
r2.raise_for_status()
token = r2.json()['token']
print('[AUTH] OK')

headers = {'Content-Type': 'application/json;charset=utf-8',
           'Authorization': f'Bearer {token}'}


def load_state() -> list:
    try:
        return json.load(open(STATE_FILE))
    except Exception:
        return []


def save_state(s: list):
    json.dump(s, open(STATE_FILE, 'w'), indent=2, ensure_ascii=False)


# ── Register ──────────────────────────────────────────────────────────────────
if CMD == 'register':
    state  = load_state()
    already = {e['api'] for e in state}

    # keyword 있으면 NT_APIS 에서 1개 선택, 없으면 전체
    if KEYWORD:
        candidates = [{'api': a} for a in NT_APIS]
        target_api = resolve_one(KEYWORD, candidates, 'api')['api']
        targets = [target_api]
    else:
        targets = NT_APIS

    new_count = 0
    for api in targets:
        if api in already:
            print(f'[SKIP] {api} (이미 등록됨)')
            continue

        obs_id   = str(uuid.uuid4())
        ch_token = str(uuid.uuid4())

        r = requests.post(
            f"{SERVER_URL}/ccgf/v1/{api}/{CLIENT_ID}/observer",
            json={'id': obs_id, 'type': 'otoplug-api@notification',
                  'address': CALLBACKS[api], 'token': ch_token, 'expiration': '-1',
                  'dataOutputType': 'simple'},
            headers=headers, timeout=15)

        print(f'     response ({r.status_code}): {r.text}')
        resp = r.json() if r.text else {}
        result_code = resp.get('result', -1)

        if result_code == 0:
            state.append({
                'api':         api,
                'id':          resp.get('id', obs_id),
                'token':       resp.get('token', ch_token),
                'type':        resp.get('type', 'otoplug-api@notification'),
                'expiration':  resp.get('expiration', '-1'),
                'resourceURI': resp.get('resourceURI', ''),
            })
            print(f'[OK] {api}')
            print(f'     id         : {resp.get("id", obs_id)}')
            print(f'     token      : {resp.get("token", ch_token)}')
            print(f'     resourceURI: {resp.get("resourceURI", "")}')
            new_count += 1
        else:
            print(f'[FAIL] {api}  result={result_code}')

    save_state(state)
    print(f'\n등록 완료: {new_count}개 신규 / 전체 {len(state)}개 활성')

# ── List ──────────────────────────────────────────────────────────────────────
elif CMD == 'list':
    state = load_state()
    if not state:
        print('[LIST] 등록된 NT 없음')
        sys.exit(0)
    print(f'[LIST] {len(state)}개 등록됨:')
    for e in state:
        print(f"  api  : {e['api']}")
        print(f"  id   : {e['id']}")
        print(f"  token: {e['token']}")
        print()

# ── Unregister (단건) ─────────────────────────────────────────────────────────
elif CMD == 'unregister':
    if not KEYWORD:
        print('[ERROR] 해제할 api 이름을 인자로 주세요')
        print('  예) python3 test_nt.py unregister device')
        print('  예) python3 test_nt.py unregister status.data.driving')
        sys.exit(1)
    state = load_state()
    e = resolve_one(KEYWORD, state, 'api')
    r = requests.post(
        f"{SERVER_URL}/ccgf/v1/{e['api']}/{CLIENT_ID}/ignore",
        json={'id': e['id'], 'type': 'otoplug-api@notification', 'token': e['token']},
        headers=headers, timeout=15)
    print(f'     response ({r.status_code}): {r.text}')
    resp = r.json() if r.text else {}
    result_code = resp.get('result', -1)
    ok = result_code == 0
    flag = '✓' if ok else f'✗ result={result_code}'
    print(f'[{flag}] {e["api"]}  id={e["id"]}')
    if ok:
        state = [x for x in state if x['id'] != e['id']]
    save_state(state)
    print(f'남은 등록: {len(state)}개')

# ── Unregister-all ────────────────────────────────────────────────────────────
elif CMD == 'unregister-all':
    state = load_state()
    if not state:
        print('[UNREGISTER] 해제할 항목 없음')
        sys.exit(0)

    for e in state:
        r = requests.post(
            f"{SERVER_URL}/ccgf/v1/{e['api']}/{CLIENT_ID}/ignore",
            json={'id': e['id'], 'type': 'otoplug-api@notification', 'token': e['token']},
            headers=headers, timeout=15)
        print(f'     response ({r.status_code}): {r.text}')
        resp = r.json() if r.text else {}
        result_code = resp.get('result', -1)
        ok = result_code == 0
        flag = '✓' if ok else f'✗ result={result_code}'
        print(f'[{flag}] {e["api"]}  id={e["id"]}')

    save_state([])
    print('전체 해제 완료')

# ── Watch ─────────────────────────────────────────────────────────────────────
elif CMD == 'watch':
    KEYWORD_TO_LOG = {
        'driving':        '/tmp/nt_driving.log',
        'driving-result': '/tmp/nt_driving_result.log',
        'device':         '/tmp/nt_device.log',
        'driving-detail': '/tmp/nt_driving_detail.log',
    }
    if KEYWORD:
        if KEYWORD not in KEYWORD_TO_LOG:
            print(f'[ERROR] 알 수 없는 keyword: {KEYWORD}')
            print(f'  선택 가능: {list(KEYWORD_TO_LOG.keys())}')
            sys.exit(1)
        LOG = KEYWORD_TO_LOG[KEYWORD]
    else:
        LOG = '/tmp/webhook.log'
    print(f'[WATCH] {LOG} 모니터링... (Ctrl+C 종료)')
    print('─' * 60)
    with open(LOG, 'a+') as f:
        f.seek(0, 2)
        while True:
            line = f.readline()
            if line:
                print(line, end='', flush=True)
            else:
                time.sleep(0.3)
