export interface ProxyConfig {
  http?: string;
  https?: string;
  all?: string;
  noProxy?: string[];
  caFile?: string;
  connectTimeoutMs?: number;
  requestTimeoutMs?: number;
}

export interface BridgeConfig {
  version?: number;
  proxy?: ProxyConfig;
  auth?: { profileId?: string; source?: string; refreshSkewSeconds?: number; snapshotPath?: string };
  runtime?: { dshCommand?: string; codexCommand?: string; appServerTimeoutMs?: number; maxRestarts?: number };
  integration?: { dshCredentialPath?: string; presetPath?: string; subagentEnabled?: boolean };
  _proxySource?: 'cli' | 'config' | 'environment' | 'none';
  [key: string]: unknown;
}

export function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }

export function validateConfig(value: unknown): BridgeConfig {
  if (!isRecord(value)) throw new Error('配置必须是 JSON 对象');
  if (value.proxy !== undefined && !isRecord(value.proxy)) throw new Error('配置 proxy 必须是对象');
  if (value.auth !== undefined && !isRecord(value.auth)) throw new Error('配置 auth 必须是对象');
  if (value.runtime !== undefined && !isRecord(value.runtime)) throw new Error('配置 runtime 必须是对象');
  return value as BridgeConfig;
}
