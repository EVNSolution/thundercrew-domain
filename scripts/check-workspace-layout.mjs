import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const required = [
  'development/front-admin-web/package.json',
  'development/front-admin-web/.env.example',
  'development/front-admin-web/app/layout.tsx',
  'development/front-admin-web/app/dashboard/page.tsx',
  'development/front-admin-web/components/layout/AppShell.tsx',
  'development/front-admin-web/lib/services/mock-data.ts',
  'development/front-admin-web/scripts/seed-admin.mjs',
  'development/front-admin-web/types/domain.ts',
  'development/service-ops-api/build.gradle.kts',
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
  if (!workspaces.includes('development/front-admin-web')) {
    failures.push('root package.json must declare development/front-admin-web as a workspace');
  }
  for (const script of ['dev', 'lint', 'typecheck', 'build']) {
    if (!rootPackage.scripts?.[script]?.includes('@thundercrew/front-admin-web')) {
      failures.push(`root npm script "${script}" must delegate to @thundercrew/front-admin-web`);
    }
  }
}

const frontendPackagePath = join(root, 'development/front-admin-web/package.json');
if (existsSync(frontendPackagePath)) {
  const frontendPackage = JSON.parse(readFileSync(frontendPackagePath, 'utf8'));
  if (frontendPackage.name !== '@thundercrew/front-admin-web') {
    failures.push('frontend package.json must be named @thundercrew/front-admin-web');
  }
  for (const script of ['dev', 'lint', 'typecheck', 'build']) {
    if (!frontendPackage.scripts?.[script]) {
      failures.push(`frontend package.json must expose "${script}" script`);
    }
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
