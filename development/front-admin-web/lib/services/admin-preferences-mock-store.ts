/**
 * Dev-only in-memory store for the per-admin NCP map toggle.
 *
 * <p>Used exclusively by the mock fallback paths in
 * {@link ./admin-preferences-data#loadAdminPreferences} and the
 * `updateAdminNcpMapPreferenceAction` server action — both of which only
 * execute when `SERVICE_OPS_API_BASE_URL` is unset (i.e. local frontend dev
 * without backend). Production deploys never touch this module because
 * {@link ./service-ops-api#serviceOpsApiConfigured} short-circuits to the
 * real service-ops client first.</p>
 *
 * <p>State is held on `globalThis` so Next.js HMR module reloads (which
 * happen on every save during `npm run dev`) do not reset the toggle —
 * otherwise editing any unrelated server file would silently flip the
 * widget back to ON and ruin the dev QA flow. Restarting the dev server
 * still resets to the default, which matches the "임시 저장" notice the
 * settings page renders in mock mode.</p>
 */
const globalKey = Symbol.for("front-admin-web.adminPreferencesMockStore");

type MockStore = {
  ncpMapEnabled: boolean;
};

type GlobalWithStore = typeof globalThis & {
  [globalKey]?: MockStore;
};

function getStore(): MockStore {
  const root = globalThis as GlobalWithStore;
  if (!root[globalKey]) {
    root[globalKey] = { ncpMapEnabled: true };
  }
  return root[globalKey];
}

export function getMockNcpMapEnabled(): boolean {
  return getStore().ncpMapEnabled;
}

export function setMockNcpMapEnabled(value: boolean): void {
  getStore().ncpMapEnabled = value;
}
