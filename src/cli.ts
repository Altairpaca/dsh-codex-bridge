#!/usr/bin/env node
import { loadConfig } from './config/load.ts';
import { proxyStatus, doctor } from './runtime/doctor.ts';
import { preflight } from './runtime/startup.ts';
import { CodexCliSource } from './auth/sources/codex-cli.ts';

const args = process.argv.slice(2);
const json = args.includes('--json');
const value = (name: string) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : undefined; };
const command = args.filter(x => !x.startsWith('--'));
function output(value: unknown) {
  if (json) console.log(JSON.stringify(value, null, 2));
  else if (typeof value === 'object' && value !== null) console.log(Object.entries(value as Record<string, unknown>).map(([k, v]) => k + ': ' + (typeof v === 'object' ? JSON.stringify(v) : v)).join('\n'));
  else console.log(value);
}

try {
  const loaded = await loadConfig({ config: value('config'), httpProxy: value('http-proxy'), httpsProxy: value('https-proxy'), allProxy: value('all-proxy'), noProxy: value('no-proxy') });
  const config = loaded.config;
  if (command[0] === 'auth' && command[1] === 'login') {
    const snapshot = await new CodexCliSource(config.runtime?.codexCommand ?? 'codex').login({ noBrowser: args.includes('--no-browser') });
    output({ loggedIn: true, source: snapshot.source, profileId: snapshot.profileId, accountHint: snapshot.accountHint, expiresAt: snapshot.expiresAt, note: 'refresh 仍由官方 Codex source 负责' });
  } else if (command[0] === 'doctor') output({ ...doctor(config), preflight: await preflight(config), warnings: loaded.warnings });
  else if (command[0] === 'proxy' && command[1] === 'show') output({ ...proxyStatus(config), warnings: loaded.warnings });
  else if (command[0] === 'auth' && command[1] === 'status') output({ ...(await preflight(config)), configPath: loaded.path, warnings: loaded.warnings });
  else { console.error('用法: dsh-codex auth login|status [--no-browser] | doctor | proxy show [--json]'); process.exitCode = 2; }
} catch (error) { console.error((error as Error).message); process.exitCode = 1; }
