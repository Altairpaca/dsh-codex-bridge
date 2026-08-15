const ALLOWED = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'all_proxy', 'no_proxy', 'NODE_USE_ENV_PROXY', 'NODE_EXTRA_CA_CERTS'];

export function proxyChildEnv(base: Record<string, string | undefined> = process.env): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of ALLOWED) { const value = base[key]; if (value) result[key] = value; }
  return result;
}
