export interface AppServerOptions { command: string; args?: string[]; env?: Record<string, string>; timeoutMs?: number; maxRestarts?: number; }

export interface AppServerHandle { pid?: number; stop(): Promise<void>; }

export async function validateAppServer(options: AppServerOptions): Promise<{ available: boolean; reason?: string }> {
  if (!options.command.trim()) return { available: false, reason: '未配置 Codex app-server 命令' };
  return { available: true };
}

export async function startAppServer(options: AppServerOptions): Promise<AppServerHandle> {
  const check = await validateAppServer(options);
  if (!check.available) throw new Error(check.reason);
  throw new Error('app-server 生命周期适配器尚未绑定当前 Codex 版本；请先完成官方能力探测');
}
