import { redactHost } from '../auth/redact.ts';
import { resolveProxy } from '../proxy/resolve.ts';
import type { BridgeConfig } from '../config/schema.ts';

export function proxyStatus(config: BridgeConfig, hostname = 'chatgpt.com'): Record<string, unknown> {
  const p = resolveProxy(config.proxy, config._proxySource ?? 'none');
  return {
    configured: !!p,
    proxy: p ? { protocol: p.protocol, host: redactHost(p.url), source: p.source } : null,
    noProxy: { hostname, matched: p?.noProxyMatch(hostname) ?? null },
    networkRequest: false,
  };
}

export function doctor(config: BridgeConfig): Record<string, unknown> {
  const proxy = proxyStatus(config);
  const runtime = config.runtime ?? {};
  const integration = config.integration ?? {};
  return {
    status: 'ok',
    configPresent: true,
    proxy,
    runtime: { dshCommand: runtime.dshCommand ?? 'dsh', codexCommand: runtime.codexCommand ?? 'codex', appServerConfigured: !!runtime.codexCommand },
    integration: { presetConfigured: !!integration.presetPath, subagentEnabled: integration.subagentEnabled !== false },
    safety: { networkRequest: false, secretsPrinted: false, refreshTokenStored: false },
  };
}
