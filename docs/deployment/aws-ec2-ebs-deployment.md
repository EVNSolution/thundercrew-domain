# AWS EC2/EBS Deployment Evidence

## Status

- Status: deployed and verified
- Date: 2026-05-01 KST
- Target issue: `EVNSolution/thundercrew-domain#102`
- Change-control issue: `EVNSolution/clever-change-control#96`
- Branch: `cc-96-ec2-ebs-deployment`

## Public endpoint

- Admin URL: `https://thcr.cleversystem.ai`
- Rider URL: `https://rider.thcr.cleversystem.ai`
- DNS: `cleversystem.ai` A records pointing at the EC2 Elastic IP
- TLS: per-hostname Let's Encrypt certificate issued on the EC2 host

The AWS EC2/EBS host under `thcr.cleversystem.ai` is the current MVP1 production basis. The permanent-domain cutover happened here — the earlier temporary `sslip.io` hostname is retired (see `aws-deployment-readiness.md`). Vercel remains only legacy/backup deployment history.

## AWS resources

- Region: `ap-northeast-2`
- EC2 instance: `i-0d4f75c35b80b25b9`
- Public IP: `3.35.123.221` (Elastic IP)
- Instance type: `t3.medium`
- OS image: Ubuntu 24.04 LTS
- Root EBS: encrypted gp3, 30 GiB, delete-on-termination
- Security group: HTTP 80 and HTTPS 443 open to the public; SSH 22 is temporarily open to `0.0.0.0/0` by operator decision so GitHub-hosted runners and multiple operators can deploy. Narrow this after the permanent operations path is settled

## Runtime topology

All services run on the EC2 host:

- Nginx reverse proxy: public 80/443 to local Next.js
- `thundercrew-front-admin-web.service`: Next.js on `127.0.0.1:3000`
- `thundercrew-service-ops-api.service`: Spring Boot on `127.0.0.1:8080`
- PostgreSQL 16 local database: `service_ops_api`

Runtime env files are stored only on the instance:

- `/etc/thundercrew/front-admin-web.env`
- `/etc/thundercrew/service-ops-api.env`

Secret values and the EC2 SSH key are not committed. The generated admin bootstrap password is stored only in the local ignored deployment cache under `.omx/cache/aws-ec2-deploy/runtime.env`.

## Validation evidence

Remote build/deploy evidence:

- Backend artifact build: `./gradlew --no-daemon clean bootJar -x test`
- Frontend install: `npm ci`
- Frontend lint: `npm run lint`
- Frontend typecheck: `npm run typecheck`
- Frontend build: `npm run build`
- Nginx config check: `nginx -t`
- TLS issuance: Certbot successfully enabled HTTPS (at provisioning time for the temporary `sslip.io` hostname; now a per-hostname certificate for `thcr.cleversystem.ai` and `rider.thcr.cleversystem.ai`)

Runtime checks:

- `systemctl is-active thundercrew-service-ops-api` -> `active`
- `systemctl is-active thundercrew-front-admin-web` -> `active`
- `systemctl is-active nginx` -> `active`
- `systemctl is-active postgresql` -> `active`
- Backend admin login API returned `200` for the seeded admin account
- Protected rider API returned `401 AUTHENTICATION_FAILED` without a bearer token
- Public frontend HTTPS endpoint returned `200 OK`
- Public login page rendered over HTTPS
- PostgreSQL Flyway history count: `6`
- Seeded admin count: `1`
- Root filesystem: 30 GiB EBS-backed disk, about 17% used after deployment

## Known follow-up

- `/actuator/health` currently returns the application's JSON `500` error path, so deployment readiness used the real auth/API checks instead.
- ~~Replace the temporary `sslip.io` hostname with the final domain when DNS is decided.~~ Resolved 2026-05-21 — `thcr.cleversystem.ai` is the permanent domain and the `sslip.io` hostname is retired.
- Main-merge updates now run through `.github/workflows/aws-ec2-deploy.yml`; keep this as the simple update lane for the existing EC2 host unless the deployment architecture changes.
- Replace the temporary SSH `0.0.0.0/0` rule with a narrower deploy access model after the multi-operator deployment constraint is resolved.
