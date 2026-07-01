import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const required = [
  'development/frontend/package.json',
  'development/frontend/.env.example',
  'development/frontend/app/layout.tsx',
  'development/frontend/app/page.tsx',
  'development/frontend/components/layout/AppShell.tsx',
  'development/frontend/lib/services/service-ops-api.ts',
  'development/frontend/scripts/seed-admin.mjs',
  'development/frontend/types/domain.ts',
  'development/backend/build.gradle.kts',
  'development/app/package.json',
  'development/app/app.json',
  'development/app/eas.json',
  'deploy/systemd/thundercrew-front-admin-web.service',
  'deploy/systemd/thundercrew-service-ops-api.service',
  'README.md',
  'WORKSPACE.md',
  'repo-map.md',
];

const forbiddenRootFrontendDirs = ['app', 'components', 'lib', 'types'];
const forbiddenRootFrontendFiles = ['next.config.ts', 'tsconfig.json', 'eslint.config.mjs'];
const forbiddenRootFrontendArtifacts = ['.next', 'next-env.d.ts', 'tsconfig.tsbuildinfo'];
const failures = [];

for (const path of required) {
  if (!existsSync(join(root, path))) {
    failures.push(`missing required workspace path: ${path}`);
  }
}

for (const path of forbiddenRootFrontendDirs) {
  if (existsSync(join(root, path))) {
    failures.push(`frontend source directory must not live at repository root: ${path}/`);
  }
}

for (const path of forbiddenRootFrontendFiles) {
  if (existsSync(join(root, path))) {
    failures.push(`frontend config file must not live at repository root: ${path}`);
  }
}

for (const path of forbiddenRootFrontendArtifacts) {
  if (existsSync(join(root, path))) {
    failures.push(`stale frontend generated artifact must not live at repository root: ${path}`);
  }
}

const rootPackagePath = join(root, 'package.json');
if (existsSync(rootPackagePath)) {
  const rootPackage = JSON.parse(readFileSync(rootPackagePath, 'utf8'));
  const workspaces = rootPackage.workspaces ?? [];
  if (!workspaces.includes('development/frontend')) {
    failures.push('root package.json must declare development/frontend as a workspace');
  }
  if (workspaces.includes('development/app')) {
    failures.push('development/app must stay OUT of the npm workspace (own EAS lockfile/toolchain)');
  }
  for (const script of ['dev', 'lint', 'typecheck', 'build']) {
    if (!rootPackage.scripts?.[script]?.includes('@thundercrew/frontend')) {
      failures.push(`root npm script "${script}" must delegate to @thundercrew/frontend`);
    }
  }
}

const frontendPackagePath = join(root, 'development/frontend/package.json');
if (existsSync(frontendPackagePath)) {
  const frontendPackage = JSON.parse(readFileSync(frontendPackagePath, 'utf8'));
  if (frontendPackage.name !== '@thundercrew/frontend') {
    failures.push('frontend package.json must be named @thundercrew/frontend');
  }
  for (const script of ['dev', 'lint', 'typecheck', 'build']) {
    if (!frontendPackage.scripts?.[script]) {
      failures.push(`frontend package.json must expose "${script}" script`);
    }
  }
}

const appPackagePath = join(root, 'development/app/package.json');
if (existsSync(appPackagePath)) {
  const appPackage = JSON.parse(readFileSync(appPackagePath, 'utf8'));
  if (appPackage.name !== 'clever-driver-app') {
    failures.push('app package.json must keep name clever-driver-app');
  }
}

if (failures.length > 0) {
  console.error('Workspace layout check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Workspace layout check passed.');
