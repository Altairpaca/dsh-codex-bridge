import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthManager } from '../../src/auth/manager.ts';
import { singleFlight } from '../../src/auth/lock.ts';
import type { AuthSnapshot } from '../../src/auth/types.ts';

const fresh = (token: string): AuthSnapshot => ({ schemaVersion: 1, profileId: 'default', source: 'test', accessToken: token, expiresAt: Date.now() + 600_000, updatedAt: new Date().toISOString() });

test('singleFlight shares one in-flight operation', async () => {
  let calls = 0;
  const operation = () => singleFlight('test-flight', async () => { calls++; await new Promise(resolve => setTimeout(resolve, 5)); return 42; });
  const values = await Promise.all([operation(), operation(), operation()]);
  assert.equal(calls, 1);
  assert.equal(values.join(','), '42,42,42');
});

test('AuthManager performs one refresh and one retry after 401', async () => {
  let refreshes = 0;
  let requests = 0;
  const manager = new AuthManager({
    source: { name: 'test', probe: async () => 'available', read: async () => ({ status: 'available' as const, snapshot: fresh('old') }) },
    refresh: async () => { refreshes++; return fresh('new'); },
  });
  const result = await manager.execute(async token => { requests++; return requests === 1 ? { status: 401 } : token; });
  assert.equal(result, 'new');
  assert.equal(refreshes, 1);
  assert.equal(requests, 2);
});
