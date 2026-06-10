"""
OTOPLUG RR (Request/Response) 패턴 테스트
사용법:
  python3 test_rr.py device    -> csi.terminal.query.info.device
  python3 test_rr.py driving   -> csi.terminal.query.driving.currentStatus
"""
import os, sys, requests, uuid, time, json

APIS = {
    'device':  'csi.terminal.query.info.device',
    'driving': 'csi.terminal.query.driving.currentStatus',
}

if len(sys.argv) < 2 or sys.argv[1] not in APIS:
    print(f'사용법: python3 {sys.argv[0]} [device|driving]')
    sys.exit(1)

API = APIS[sys.argv[1]]
SERVER_URL   = os.environ['SERVER_URL']
CLIENT_ID    = os.environ['CLIENT_ID']
SECURED_CODE = os.environ['SECURED_CODE']
TERMINAL_ID  = 'c972b646ef89aa271e63bc918636aa42'
CALLBACK     = 'https://thcr.cleversystem.ai/otoplug-test'
WAIT_SEC     = 30

# Auth
r1 = requests.get(
    f"{SERVER_URL}/ccgf/v1/common.auth/?clientID={CLIENT_ID}&securedCode={SECURED_CODE}&sessionID={uuid.uuid4()}",
    timeout=15)
ac = r1.json()['authorizeCode']
r2 = requests.post(f"{SERVER_URL}/ccgf/v1/common.auth.token",
    json={'clientID': CLIENT_ID, 'authorizeCode': ac, 'redirectURI': None}, timeout=15)
token = r2.json()['token']
print(f'[AUTH] OK')

headers = {'Content-Type': 'application/json;charset=utf-8', 'Authorization': f'Bearer {token}'}

# RR 요청
print(f'[REQUEST] {API}')
open('/tmp/webhook.log', 'w').close()

r = requests.post(
    f"{SERVER_URL}/ccgf/v1/{API}/{CLIENT_ID}",
    json={'terminalID': TERMINAL_ID, 'callbackURI': CALLBACK},
    headers=headers, timeout=15)

print(f'[RESPONSE] {r.status_code}: {r.text}')
resp = r.json()

ERR = {8000011: 'Cool Time 위반 (3~180s 후 재시도)', 8000100: 'Terminal Not Connected'}
if resp.get('result') in ERR:
    print(f'[ERROR] {ERR[resp["result"]]}'); sys.exit(1)
if resp.get('result') != 0:
    print(f'[ERROR] result={resp.get("result")}'); sys.exit(1)

print(f'[WAIT] sequenceNumber={resp["sequenceNumber"]} | {WAIT_SEC}s 대기...')
for i in range(WAIT_SEC):
    time.sleep(1)
    log = open('/tmp/webhook.log').read().strip()
    if log:
        print(f'[CALLBACK] {i+1}s 후 수신!')
        try:
            print(json.dumps(json.loads(log.split('BODY: ', 1)[1]), indent=2, ensure_ascii=False))
        except:
            print(log[:1000])
        sys.exit(0)

print(f'[TIMEOUT] {WAIT_SEC}s 내 callback 없음')
