# AWS Deployment Readiness

## Current status

- Frontend production is still on Vercel: `https://thundercrew-domain.vercel.app`.
- AWS CLI local login is available for account `902837199612`.
- `ap-northeast-2` currently has no Amplify apps for this account at the time of the readiness check.
- GitHub repository Actions are enabled.
- Repository-level GitHub Actions variables/secrets are empty.
- The organization variable `PROD_AWS_ROLE_ARN` cannot be read through the current local GitHub token because org Actions variable read requires org admin or fine-grained actions variable permission.

## What `PROD_AWS_ROLE_ARN` proves

`PROD_AWS_ROLE_ARN` is the role ARN that a GitHub Actions workflow can try to assume through OIDC. By itself it does not deploy the application.

The minimum deploy chain still needs:

1. GitHub Actions workflow permission `id-token: write`.
2. `aws-actions/configure-aws-credentials` with `role-to-assume: ${{ vars.PROD_AWS_ROLE_ARN }}`.
3. AWS IAM role trust policy allowing this repository/ref/environment as the OIDC subject.
4. AWS region and a concrete hosting target.
5. AWS-side runtime environment variables for the frontend/backend.

## Smoke workflow

`.github/workflows/aws-oidc-smoke.yml` is a manual, non-deploying smoke test.

It checks:

- whether `vars.PROD_AWS_ROLE_ARN` is visible to this repository workflow;
- whether GitHub OIDC can assume that role;
- whether `aws sts get-caller-identity` succeeds after assumption.

It does not create, update, or delete AWS resources.

## Frontend hosting recommendation

The current frontend has dynamic/server-rendered Next.js routes, server actions, and server-side API calls. Therefore S3-only static hosting is not a direct replacement for Vercel unless the app is converted to static export.

Recommended AWS paths:

1. **AWS Amplify Hosting compute** for the frontend Next.js app.
2. **OpenNext/SST-style AWS deployment** if we want infrastructure-as-code ownership and Lambda/CloudFront resources.

Do not remove Vercel production until one AWS path is deployed and verified.

## Environment variable ownership

Shareable metadata:

- AWS account ID
- AWS region
- frontend public URL
- non-secret deployment IDs
- environment variable names

Do not commit or print secret values:

- database URLs/passwords
- service-role keys
- JWT secrets
- admin passwords
- token values

`PROD_AWS_ROLE_ARN` is not a password, but it is deployment authority metadata. Keep it in GitHub organization variables rather than committed files.
