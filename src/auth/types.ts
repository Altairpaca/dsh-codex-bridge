export type AuthSource = 'snapshot' | 'auth-json' | 'app-server' | (string & {});

export interface AuthSnapshot {
  schemaVersion: number;
  profileId: string;
  source: AuthSource;
  accountHint?: string;
  accessToken: string;
  issuedAt?: string | number;
  expiresAt?: string | number;
  updatedAt: string | number;
}

export interface LegacyAuthSnapshot { accessToken: string; expiresAt?: string | number; accountId?: string; [key: string]: unknown }

export function validateAuthSnapshot(value: unknown): AuthSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('AuthSnapshot 必须是对象');
  const v = value as Record<string, unknown>;
  if (typeof v.accessToken !== 'string' || !v.accessToken) throw new Error('AuthSnapshot 缺少 accessToken');
  const legacy = v.schemaVersion === undefined;
  if (!legacy && (typeof v.schemaVersion !== 'number' || v.schemaVersion < 1)) throw new Error('AuthSnapshot schemaVersion 无效');
  if (!legacy && typeof v.profileId !== 'string') throw new Error('AuthSnapshot 缺少 profileId');
  if (!legacy && typeof v.source !== 'string') throw new Error('AuthSnapshot 缺少 source');
  for (const k of ['issuedAt','expiresAt','updatedAt']) if (v[k] !== undefined && typeof v[k] !== 'string' && typeof v[k] !== 'number') throw new Error(k+' 必须是字符串或数字');
  if (!legacy && v.updatedAt === undefined) throw new Error('AuthSnapshot 缺少 updatedAt');
  const now = new Date().toISOString();
  return { schemaVersion: legacy ? 1 : v.schemaVersion as number, profileId: legacy ? (typeof v.accountId==='string' ? v.accountId : 'default') : v.profileId as string, source: legacy ? 'snapshot' : v.source as AuthSource, accountHint: typeof v.accountHint==='string' ? v.accountHint : (typeof v.accountId==='string' ? v.accountId : undefined), accessToken:v.accessToken, issuedAt:v.issuedAt as string|number|undefined, expiresAt:v.expiresAt as string|number|undefined, updatedAt:(v.updatedAt ?? now) as string|number };
}
export function expiresAtMs(value:string|number|undefined):number|undefined { if(value===undefined)return undefined; const n=typeof value==='number'?(value<1e12?value*1000:value):Date.parse(value); return Number.isFinite(n)?n:undefined }
export function isExpired(value:string|number|undefined,now=Date.now()):boolean { const n=expiresAtMs(value); return n!==undefined&&n<=now }
