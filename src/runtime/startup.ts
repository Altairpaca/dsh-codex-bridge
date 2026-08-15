import { join } from 'node:path';
import { homedir } from 'node:os';
import type { BridgeConfig } from '../config/schema.ts';
import { AuthJsonSource } from '../auth/sources/auth-json.ts';
import { AuthManager } from '../auth/manager.ts';
import { SnapshotStore } from '../store/snapshot-store.ts';
import { expiresAtMs } from '../auth/types.ts';

export function createAuthManager(config: BridgeConfig): AuthManager {
  const auth = config.auth ?? {};
  const snapshotPath = auth.snapshotPath ?? join(homedir(), '.dsh', 'codex-bridge', 'snapshot.json');
  return new AuthManager({ source: new AuthJsonSource(), store: new SnapshotStore(snapshotPath), lockPath: snapshotPath + '.lock', refreshSkew: (auth.refreshSkewSeconds ?? 300) * 1000 });
}

export async function preflight(config: BridgeConfig): Promise<Record<string, unknown>> {
  const manager = createAuthManager(config);
  await manager.load();
  const snapshot = manager.snapshot;
  const expiry = expiresAtMs(snapshot?.expiresAt);
  return {
    auth: { state: manager.status, source: snapshot?.source ?? 'codex-auth-json', profileId: snapshot?.profileId ?? 'default', accountHint: snapshot?.accountHint, expiresAt: snapshot?.expiresAt, expiresInSeconds: expiry === undefined ? undefined : Math.floor((expiry - Date.now()) / 1000), reason: manager.lastError?.message },
    mode: 'snapshot',
    refreshAvailable: false,
    requiresOfficialRefreshSource: manager.status === 'EXPIRING' || manager.status === 'NEED_LOGIN' || manager.status === 'UNAVAILABLE' || manager.status === 'CORRUPT',
  };
}
