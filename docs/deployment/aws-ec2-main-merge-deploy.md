# AWS EC2 Main-Merge Deployment

## Status

- Target issue: `EVNSolution/thundercrew-domain#104`
- Change-control issue: `EVNSolution/clever-change-control#97`
- Branch: `cc-97-main-merge-ec2-deploy`
- Deployment model: update the existing EC2/EBS host when `main` receives a push.

This change does not create EC2, EBS, network, DNS, or database resources. It only
adds the workflow needed to update the application on the already-provisioned
host.

## Branch policy

| Branch | Role | Deployment effect |
| --- | --- | --- |
| `dev` | integration branch for issue/PR work | no production deploy |
| `main` | production promotion branch | `push` to `main` runs AWS EC2 deploy |
| `cc-<change-control>-<slug>` | scoped work branch | no production deploy |

The normal flow is:

```text
issue/change-control
→ cc-* branch
→ PR into dev
→ verify dev
→ promotion PR/merge into main
→ GitHub Actions deploys the existing EC2 host
```

## Workflow

`.github/workflows/aws-ec2-deploy.yml` runs on:

- `push` to `main`
- manual `workflow_dispatch` from `main` only

The workflow:

1. Validates required GitHub variables/secrets.
2. Assumes the production AWS role with GitHub OIDC.
3. Confirms the configured EC2 instance is running.
4. SSHes into the existing EC2 host.
5. Checks out the deployed commit under `/opt/thundercrew/current`.
6. Builds the Spring Boot artifact with `bootJar -x test`.
7. Builds the Next.js admin web.
8. Restarts `thundercrew-service-ops-api` and `thundercrew-front-admin-web`.
9. Confirms the expected systemd services are `active`.

## Required GitHub configuration

The workflow uses GitHub environment `prod` and expects these values to be
available from organization/repository/environment variables or secrets.

Variables:

- `PROD_AWS_ROLE_ARN` — AWS role assumed through OIDC.
- `AWS_REGION` — currently `ap-northeast-2`.
- `AWS_EC2_INSTANCE_ID` — currently `i-0d4f75c35b80b25b9`.
- `AWS_EC2_HOST` — EC2 SSH host, currently the public IP.
- `AWS_EC2_USER` — currently `ubuntu`.
- `AWS_EC2_DEPLOY_PATH` — currently `/opt/thundercrew/current`.
- `AWS_EC2_PUBLIC_URL` — currently `https://thundercrew-domain.43.201.57.147.sslip.io`.

Secrets:

- `AWS_EC2_SSH_PRIVATE_KEY` — private key for the EC2 deploy user.
- `AWS_EC2_KNOWN_HOSTS` — pinned SSH host key entry for StrictHostKeyChecking.

Do not commit any of the secret values.

## Known constraints

- The current EC2 host does not run Docker, so backend Testcontainers tests are
  not part of the on-host deployment update. The deployment build uses
  `bootJar -x test` and relies on prior PR validation for full tests.
- The workflow intentionally uses a simple deployment model: build artifacts,
  restart systemd services, and confirm service units are `active`. HTTP smoke
  checks are excluded from the deployment action and should be run separately
  when needed.
- The current URL is a temporary `sslip.io` hostname. A permanent domain can
  replace it later without changing the branch policy.

## Temporary SSH access policy

Current temporary operations decision: the EC2 security group allows TCP/22 from
`0.0.0.0/0` so GitHub-hosted runners and multiple operators can deploy without
per-run source IP changes.

This is an explicit temporary compromise. Keep SSH key access restricted through
GitHub/environment secrets and replace this with a narrower deploy access model
when the team settles the permanent operations path.
