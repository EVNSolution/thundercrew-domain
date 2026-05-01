import assert from "node:assert/strict";
import test from "node:test";

import {
  SERVICE_OPS_ACCESS_TOKEN_COOKIE,
  SERVICE_OPS_REFRESH_TOKEN_COOKIE,
  clearServiceOpsSessionCookies,
  logoutServiceOpsSessionCookies,
  readServiceOpsSessionTokens,
  refreshServiceOpsSessionCookies,
  setServiceOpsSessionCookies
} from "./service-ops-session-core.ts";

function memoryCookieStore(initial = {}) {
  const jar = new Map(Object.entries(initial).map(([name, value]) => [name, { value }]));
  const operations = [];

  return {
    operations,
    delete(name) {
      operations.push({ name, type: "delete" });
      jar.delete(name);
    },
    get(name) {
      return jar.get(name);
    },
    set(name, value, options) {
      operations.push({ name, options, type: "set", value });
      jar.set(name, { options, value });
    },
    value(name) {
      return jar.get(name)?.value ?? null;
    }
  };
}

const authResponse = {
  accessToken: "new-access-token",
  admin: {
    displayName: "운영자",
    email: "admin@example.com",
    id: "admin-1",
    loginId: "admin",
    role: "ADMIN"
  },
  expiresAt: "2026-04-30T09:30:00.000Z",
  refreshExpiresAt: "2026-05-30T09:30:00.000Z",
  refreshToken: "new-refresh-token",
  tokenType: "Bearer"
};

test("setServiceOpsSessionCookies writes access and refresh tokens as HTTP-only secure cookies", () => {
  const cookieStore = memoryCookieStore();

  setServiceOpsSessionCookies(cookieStore, authResponse, { secure: true });

  assert.equal(cookieStore.value(SERVICE_OPS_ACCESS_TOKEN_COOKIE), "new-access-token");
  assert.equal(cookieStore.value(SERVICE_OPS_REFRESH_TOKEN_COOKIE), "new-refresh-token");
  const accessSet = cookieStore.operations.find((operation) => operation.name === SERVICE_OPS_ACCESS_TOKEN_COOKIE);
  const refreshSet = cookieStore.operations.find((operation) => operation.name === SERVICE_OPS_REFRESH_TOKEN_COOKIE);
  assert.equal(accessSet.options.httpOnly, true);
  assert.equal(accessSet.options.secure, true);
  assert.equal(accessSet.options.sameSite, "lax");
  assert.equal(accessSet.options.path, "/");
  assert.equal(accessSet.options.expires.toISOString(), "2026-04-30T09:30:00.000Z");
  assert.equal(refreshSet.options.expires.toISOString(), "2026-05-30T09:30:00.000Z");
});

test("refreshServiceOpsSessionCookies rotates cookies using only the stored refresh token", async () => {
  const cookieStore = memoryCookieStore({ [SERVICE_OPS_REFRESH_TOKEN_COOKIE]: "old-refresh-token" });
  const refreshRequests = [];
  const client = {
    async refresh(request) {
      refreshRequests.push(request);
      return authResponse;
    }
  };

  const refreshed = await refreshServiceOpsSessionCookies(cookieStore, client, { secure: false });

  assert.equal(refreshed, true);
  assert.deepEqual(refreshRequests, [{ refreshToken: "old-refresh-token" }]);
  assert.equal(cookieStore.value(SERVICE_OPS_ACCESS_TOKEN_COOKIE), "new-access-token");
  assert.equal(cookieStore.value(SERVICE_OPS_REFRESH_TOKEN_COOKIE), "new-refresh-token");
  assert.equal(readServiceOpsSessionTokens(cookieStore).accessToken, "new-access-token");
});

test("refreshServiceOpsSessionCookies clears both cookies when backend refresh fails", async () => {
  const cookieStore = memoryCookieStore({
    [SERVICE_OPS_ACCESS_TOKEN_COOKIE]: "old-access-token",
    [SERVICE_OPS_REFRESH_TOKEN_COOKIE]: "old-refresh-token"
  });
  const client = {
    async refresh() {
      throw new Error("refresh rejected");
    }
  };

  const refreshed = await refreshServiceOpsSessionCookies(cookieStore, client, { secure: false });

  assert.equal(refreshed, false);
  assert.equal(cookieStore.value(SERVICE_OPS_ACCESS_TOKEN_COOKIE), null);
  assert.equal(cookieStore.value(SERVICE_OPS_REFRESH_TOKEN_COOKIE), null);
  assert.deepEqual(
    cookieStore.operations.filter((operation) => operation.type === "delete").map((operation) => operation.name),
    [SERVICE_OPS_ACCESS_TOKEN_COOKIE, SERVICE_OPS_REFRESH_TOKEN_COOKIE]
  );
});

test("logoutServiceOpsSessionCookies clears local cookies even when backend logout fails", async () => {
  const cookieStore = memoryCookieStore({
    [SERVICE_OPS_ACCESS_TOKEN_COOKIE]: "access-token",
    [SERVICE_OPS_REFRESH_TOKEN_COOKIE]: "refresh-token"
  });
  const logoutTokens = [];

  await logoutServiceOpsSessionCookies(cookieStore, {
    configured: true,
    createClient(accessToken) {
      logoutTokens.push(accessToken);
      return {
        async logout() {
          throw new Error("backend logout unavailable");
        }
      };
    }
  });

  assert.deepEqual(logoutTokens, ["access-token"]);
  assert.equal(cookieStore.value(SERVICE_OPS_ACCESS_TOKEN_COOKIE), null);
  assert.equal(cookieStore.value(SERVICE_OPS_REFRESH_TOKEN_COOKIE), null);
});

test("clearServiceOpsSessionCookies deletes access and refresh cookies without exposing ids", () => {
  const cookieStore = memoryCookieStore({
    [SERVICE_OPS_ACCESS_TOKEN_COOKIE]: "access-token",
    [SERVICE_OPS_REFRESH_TOKEN_COOKIE]: "refresh-token"
  });

  clearServiceOpsSessionCookies(cookieStore);

  assert.deepEqual(cookieStore.operations, [
    { name: SERVICE_OPS_ACCESS_TOKEN_COOKIE, type: "delete" },
    { name: SERVICE_OPS_REFRESH_TOKEN_COOKIE, type: "delete" }
  ]);
});
