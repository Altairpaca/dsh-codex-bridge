import type { ProxyConfig } from '../config/schema.ts';

export type ProxySource = 'cli' | 'config' | 'environment' | 'none';
export interface ResolvedProxy { protocol: string; url: string; source: ProxySource; host: string; noProxy: string[]; noProxyMatch: (hostname: string) => string | undefined; }

function match(host: string, list: string[]): string | undefined {
  const h = host.toLowerCase();
  return list.find(raw => {
    const p = raw.toLowerCase().trim();
    if (!p || p.startsWith('#')) return false;
    if (p === '*') return true;
    const n = p.replace(/^\./, '').split(':')[0];
    return h === n || h.endsWith('.' + n);
  });
}

export function resolveProxy(config: ProxyConfig = {}, source: ProxySource = 'none', target = 'https'): ResolvedProxy | undefined {
  const url = target === 'http' ? (config.http ?? config.all) : (config.https ?? config.http ?? config.all);
  if (!url) return undefined;
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('代理地址无效: ' + redactProxyUrl(url)); }
  if (!['http:', 'https:', 'socks5:', 'socks5h:'].includes(parsed.protocol)) throw new Error('不支持的代理协议: ' + parsed.protocol);
  const noProxy = config.noProxy ?? [];
  return { protocol: parsed.protocol, url, source, host: parsed.hostname + (parsed.port ? ':' + parsed.port : ''), noProxy, noProxyMatch: hostname => match(hostname, noProxy) };
}

export function redactProxyUrl(value: string): string { try { const u = new URL(value); u.username = ''; u.password = ''; u.search = ''; return u.toString(); } catch { return '[invalid-proxy-url]'; } }
