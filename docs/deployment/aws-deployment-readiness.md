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

## Latest smoke result

Run: `25194769461` on branch `dev` at `2026-05-01` KST.

Result: **failed before AWS STS** because `vars.PROD_AWS_ROLE_ARN` was empty in the workflow environment. This means the GitHub organization variable is not visible to `EVNSolution/thundercrew-domain`, is not set, or is restricted away from this repository.

AWS-side read-only checks showed that the account has a GitHub Actions OIDC provider and deploy-related IAM roles, but no Amplify app exists in `ap-northeast-2`. Exact production role ARNs should remain in GitHub organization variables, not in committed files.

Required next actions before AWS deployment can run:

1. Expose organization variable `PROD_AWS_ROLE_ARN` to `EVNSolution/thundercrew-domain`.
2. Confirm the referenced IAM role trust policy allows this repository and production environment subject.
3. Choose and create the AWS hosting target, such as Amplify Hosting compute or an OpenNext/SST-managed stack.
4. Keep Vercel as the active frontend deployment until the AWS target has a verified public URL.

The smoke workflow now runs under GitHub environment `prod` so a production OIDC trust policy can target `repo:EVNSolution/thundercrew-domain:environment:prod`.

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
