import { spawn } from 'node:child_process';
import type { AuthSource } from './types.ts';
import type { AuthSnapshot } from '../types.ts';
import { AuthJsonSource } from './auth-json.ts';

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env: process.env });
    child.once('error', reject);
    child.once('exit', (code: number | null) => code === 0 ? resolve() : reject(new Error(command + ' 退出码: ' + code)));
  });
}

export class CodexCliSource implements AuthSource {
  readonly name = 'codex-cli';
  private readonly file = new AuthJsonSource();
  constructor(readonly command = 'codex') {}
  async probe() { try { await run(this.command, ['--version']); return 'available' as const; } catch { return 'unavailable' as const; } }
  async read() { return this.file.read(); }
  async login(options: { noBrowser?: boolean } = {}): Promise<AuthSnapshot> {
    await run(this.command, options.noBrowser ? ['login', '--no-browser'] : ['login']);
    return this.file.read().then(result => { if (!result.snapshot) throw result.error ?? new Error('Codex 登录后未生成有效凭据'); return result.snapshot; });
  }
}
