# dsh-codex-bridge

[简体中文](README.md)

A user-space bridge for using the official Codex / ChatGPT login path with DeepSeek Harness (DSH), without embedding an OpenAI API key into this repository.

> **Status:** experimental integration project. The runtime CLI can inspect Codex login state, resolve proxy configuration, run startup checks, and preserve a safe snapshot. Automatic refresh remains owned by the official Codex source; the historical token-sync script is retained only as a legacy fallback.

## Boundary

This project does **not** reimplement Codex authentication, DSH sessions, or model execution. Its job is to connect existing product-owned capabilities with explicit health and credential boundaries:

```text
Official Codex login
        ↓
read-only auth / status observation
        ↓
DSH provider + agent preset configuration
        ↓
startup health / proxy / snapshot checks
        ↓
DSH execution
```

The preferred path is to call the official `codex login` flow and keep refresh ownership with Codex. Copying access tokens into another product is treated as a compatibility fallback, not the target architecture.

## Repository layout

- `src/` — bridge runtime and CLI;
- `tests/` — runtime tests;
- `agent-presets/code-gpt/` — DSH user-level preset for GPT-backed main conversation and Codex subagent delegation;
- `scripts/check-codex-health.ps1` — compatibility health check for older Windows deployments;
- `scripts/sync-codex-token.ps1` — legacy token-copy fallback;
- `docs/` — installation and configuration notes.

## Development

Requirements: Bun and a TypeScript-capable development environment. Codex/DSH are only required for real integration checks.

```bash
bun install
bun test
bunx tsc --noEmit
```

CI runs tests, TypeScript checks, and a repository scan for credential-like filenames. Real OAuth/network checks are intentionally not executed in CI.

## User flow

Complete the official login first:

```bash
codex login
```

Then use the bridge CLI:

```bash
bun src/cli.ts auth status
bun src/cli.ts doctor
```

A DSH installation can then register the existing `openai-codex` provider and the official Codex subagent package. The exact provider/model names remain DSH/Codex compatibility concerns and should be verified against the versions in use rather than treated as a permanent contract in this repository.

## Security and credential handling

- never commit `~/.codex/auth.json`, DSH credential files, access tokens, cookies, or `.env` files;
- prefer status/reference metadata over copying product-owned credentials;
- redact usernames, home-directory paths, account identifiers, and proxy credentials from public diagnostics;
- report security-sensitive problems privately according to [`SECURITY.md`](SECURITY.md).

## Maintenance scope

This repository is a focused integration project, not a general authentication library. New work should preserve three invariants:

1. **official auth ownership** — Codex remains the authority for login/refresh;
2. **explicit failure** — missing/expired auth, proxy failures, or incompatible DSH state should be reported instead of silently falling back;
3. **minimal credential surface** — diagnostics and snapshots must avoid persisting reusable secrets.

For the broader explainable multi-model routing project, see [DSHelm](https://github.com/Altairpaca/dshelm).

MIT License.
