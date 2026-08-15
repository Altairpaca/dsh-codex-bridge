declare const process: { argv: string[]; env: Record<string, string | undefined>; pid: number; exitCode?: number };
declare namespace NodeJS { interface ErrnoException extends Error { code?: string } }
declare module 'node:os' { export function homedir(): string }
declare module 'node:path' { export function join(...parts: string[]): string; export function resolve(...parts: string[]): string; export function dirname(path: string): string }
declare module 'node:fs/promises' { export function readFile(path: string, encoding: string): Promise<string>; export function mkdir(path: string, opts?: unknown): Promise<void>; export function rename(a: string, b: string): Promise<void>; export function writeFile(path: string, data: string, opts?: unknown): Promise<void>; export function unlink(path: string): Promise<void>; export function open(path: string, flags: string): Promise<any>; export function stat(path: string): Promise<{mtimeMs: number}>; export function rm(path: string, opts?: unknown): Promise<void>; export function copyFile(a: string, b: string): Promise<void>; export function chmod(path: string, mode: number): Promise<void> }
declare module 'node:crypto' { export function randomUUID(): string }
declare module 'node:child_process' { export function spawn(command: string, args?: string[], options?: unknown): any }
declare module 'node:test' { const test: (name: string, fn: () => void | Promise<void>) => void; export default test }
declare module 'node:assert/strict' { const assert: { equal(a: unknown, b: unknown): void }; export default assert }
declare const Buffer: { from(value: string, encoding?: string): { toString(encoding?: string): string } };
