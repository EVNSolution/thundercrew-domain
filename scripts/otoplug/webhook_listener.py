"""
OTOPLUG webhook 수신 서버 (RR callback + NT 공용)

사용법:
  # 백그라운드 실행
  nohup python3 webhook_listener.py &

  # 로그 파일 위치
  /tmp/webhook.log              <- RR + 기타
  /tmp/nt_driving.log           <- csi.terminal.status.data.driving
  /tmp/nt_driving_result.log    <- csi.terminal.result.data.driving
  /tmp/nt_device.log            <- csi.terminal.status.info.device
  /tmp/nt_driving_detail.log    <- csi.terminal.status.data.drivingDetail
"""
import http.server, json, datetime, os

PORT = int(os.environ.get('PORT', 8888))

# path → 로그 파일 매핑
PATH_TO_LOG = {
    '/otoplug-test/driving':        '/tmp/nt_driving.log',
    '/otoplug-test/driving-result': '/tmp/nt_driving_result.log',
    '/otoplug-test/device':         '/tmp/nt_device.log',
    '/otoplug-test/driving-detail': '/tmp/nt_driving_detail.log',
}
DEFAULT_LOG = '/tmp/webhook.log'

_handles = {}

def get_fh(path: str):
    log_file = PATH_TO_LOG.get(path, DEFAULT_LOG)
    if log_file not in _handles:
        _handles[log_file] = open(log_file, 'a', buffering=1)
    return _handles[log_file]

def log(path: str, msg: str):
    fh = get_fh(path)
    fh.write(msg + '\n')
    print(msg, flush=True)


class Handler(http.server.BaseHTTPRequestHandler):

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body   = self.rfile.read(length)
        path   = self.path

        sep = '=' * 60
        log(path, f"\n{sep}")
        log(path, f"[{datetime.datetime.now()}] POST {path}")

        for key in ('OTOPLUG-Channel-ID', 'OTOPLUG-Channel-Token',
                    'OTOPLUG-Channel-Expiration', 'OTOPLUG-Resource-URI'):
            val = self.headers.get(key)
            if val:
                log(path, f"  {key}: {val}")

        if body:
            try:
                parsed = json.loads(body)
                log(path, "BODY: " + json.dumps(parsed, indent=2, ensure_ascii=False))
            except Exception:
                log(path, "BODY: " + body.decode(errors='replace'))

        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'OK')

    def log_message(self, *a):
        pass


if __name__ == '__main__':
    server = http.server.HTTPServer(('0.0.0.0', PORT), Handler)
    print(f'[{datetime.datetime.now()}] Listening on 0.0.0.0:{PORT}')
    for p, f in PATH_TO_LOG.items():
        print(f'  {p} → {f}')
    print(f'  (기타) → {DEFAULT_LOG}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('서버 종료')
        for fh in _handles.values():
            fh.close()
