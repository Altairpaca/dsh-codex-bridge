import type { AuthSnapshot } from '../types.ts';
export interface AuthSourceResult { snapshot?: AuthSnapshot; status: 'available' | 'unavailable' | 'missing' | 'corrupt'; error?: Error; }
export interface AuthSource { readonly name: string; probe(): Promise<'available' | 'unavailable'>; read(): Promise<AuthSourceResult>; login?(options?: { noBrowser?: boolean }): Promise<AuthSnapshot>; refresh?(snapshot?: AuthSnapshot): Promise<AuthSnapshot>; }
export interface AppServerCapability { available: false; reason: 'not-implemented'; }
export const appServerCapability: AppServerCapability = { available: false, reason: 'not-implemented' };
