# AWS Deployment Readiness

## Current status

- MVP1 production basis is now AWS EC2/EBS, not Vercel.
- Public endpoint: `https://thundercrew-domain.43.201.57.147.sslip.io`.
- DNS/TLS basis: temporary `sslip.io` hostname bound to EC2 public IP `43.201.57.147`, with HTTPS certificate issued for that hostname.
- Runtime topology: Nginx fronts the Next.js admin web and Spring Boot service-ops API on the existing EC2 host; PostgreSQL runs locally on the same host for the MVP baseline.
- Deployment trigger: push/merge to `main` runs `.github/workflows/aws-ec2-deploy.yml`.
- The deploy workflow uses GitHub OIDC via `PROD_AWS_ROLE_ARN` and updates the existing EC2/EBS host. It does not create EC2/EBS resources.
- Vercel remains only historical frontend-only deployment evidence / legacy backup context until a permanent AWS domain is chosen.

## What `PROD_AWS_ROLE_ARN` proves

`PROD_AWS_ROLE_ARN` is the role ARN that a GitHub Actions workflow assumes through OIDC. By itself it does not deploy the application, but it is the authority link used by the current main-merge EC2 deploy workflow.

The active deploy chain is:

1. GitHub Actions workflow permission `id-token: write`.
2. `aws-actions/configure-aws-credentials` with `role-to-assume: ${{ vars.PROD_AWS_ROLE_ARN }}`.
3. AWS IAM role trust policy allowing this repository's production environment subject.
4. Existing EC2 host metadata provided through GitHub variables.
5. SSH private key and known-host data provided through GitHub environment secrets.
6. On-host runtime env files and systemd units already provisioned on the EC2 instance.

## OIDC smoke workflow

`.github/workflows/aws-oidc-smoke.yml` is a manual, non-deploying OIDC verification workflow.

It checks:

- whether `vars.PROD_AWS_ROLE_ARN` is visible to this repository workflow;
- whether GitHub OIDC can assume that role;
- whether `aws sts get-caller-identity` succeeds after assumption.

It does not create, update, or delete AWS resources.

Latest recorded OIDC smoke result: run `25195213443` on branch `dev` at `2026-05-01` KST passed. The workflow assumed the production deploy role through GitHub OIDC and `aws sts get-caller-identity` succeeded in account `902837199612`.

## Main-merge EC2 deployment

`.github/workflows/aws-ec2-deploy.yml` is the active production update workflow.

- Trigger: `push` to `main` or manual `workflow_dispatch` from `main`.
- Scope: update the existing EC2/EBS host only.
- Deployment model: simple build/restart/systemd-active verification.
- HTTP smoke checks are intentionally excluded from the deployment action and should be run separately when needed.
- Current public URL: `https://thundercrew-domain.43.201.57.147.sslip.io`.

## Temporary SSH access policy

Current temporary operations decision: the EC2 security group allows TCP/22 from `0.0.0.0/0` so GitHub-hosted runners and multiple operators can deploy without per-run source IP changes.

This is a deliberate temporary compromise. Keep SSH key access restricted through GitHub/environment secrets and replace the wide SSH rule with a narrower deploy access model when the team settles the permanent operations path.

## Frontend hosting note

The current frontend has dynamic/server-rendered Next.js routes, server actions, and server-side API calls. Therefore S3-only static hosting is not a direct replacement unless the app is converted to static export.

The current production path is the EC2/EBS host behind Nginx. Amplify Hosting compute or OpenNext/SST-style deployment can be revisited later only if the team decides to replace the existing EC2 lane.

## Environment variable ownership

Shareable metadata:

- AWS account ID
- AWS region
- frontend/backend public URL
- non-secret deployment IDs
- environment variable names

Do not commit or print secret values:

- database URLs/passwords
- service-role keys
- JWT secrets
- admin passwords
- token values
- SSH private keys

`PROD_AWS_ROLE_ARN` is not a password, but it is deployment authority metadata. Keep it in GitHub organization/environment variables rather than committed files.
