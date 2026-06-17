# rider.thcr.cleversystem.ai 서브도메인 셋업 (EC2)

라이더 웹앱을 별도 호스트로 노출. 코드(미들웨어)는 host로 분기하므로 같은
Next 업스트림(127.0.0.1:3000)에 프록시하면 된다. admin server block을 복제.

## 1) DNS
`rider.thcr.cleversystem.ai` A 레코드 → `3.35.123.221`

## 2) nginx server block (admin 블록 복제, server_name만 변경)
/etc/nginx/sites-available/ 의 기존 admin 블록을 복사해 새 파일 생성:

    server {
        server_name rider.thcr.cleversystem.ai;
        location / {
            proxy_pass http://127.0.0.1:3000;
            proxy_http_version 1.1;
            proxy_set_header Host $host;            # 미들웨어 호스트 판정에 필수
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
    }

(기존 admin 블록의 proxy_set_header 세트를 그대로 따르되 server_name만 교체.
proxy_set_header Host $host 가 빠지면 미들웨어가 라이더 호스트를 인식 못 함.)

활성화: `sudo ln -s ../sites-available/<file> /etc/nginx/sites-enabled/ && sudo nginx -t`

## 3) TLS
`sudo certbot --nginx -d rider.thcr.cleversystem.ai`
(certbot이 443 server block + 인증서 + 자동 갱신을 구성)

## 4) reload
`sudo systemctl reload nginx`

## 5) 검증
- https://rider.thcr.cleversystem.ai/         → 307 → /rider/login → 200(로그인 폼)
- https://rider.thcr.cleversystem.ai/management → 307 → /rider
- https://thcr.cleversystem.ai/rider/login    → 307 → / → (미인증) /login
- https://thcr.cleversystem.ai/login          → 정상(admin)
