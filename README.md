# dsh-codex-bridge

[English](README.en.md)

面向 DeepSeek Harness (DSH) 的用户层 Codex / ChatGPT 登录桥接项目。目标是在不把 OpenAI API Key 写入仓库的情况下，复用官方 Codex 登录能力，并把认证状态、代理配置、启动检查和失败边界显式化。

> **状态：实验性集成项目。** runtime CLI 已覆盖 Codex 登录状态读取、代理解析、启动体检和安全 snapshot；自动 refresh 仍由官方 Codex source 负责。历史 `sync-codex-token.ps1` 仅保留为 legacy fallback。

## 边界

本项目不重写 Codex OAuth、不维护 DSH session，也不自己执行模型请求。职责边界是：

```text
官方 Codex login
      ↓
只读认证 / 状态观察
      ↓
DSH provider + agent preset 配置
      ↓
启动体检 / 代理 / snapshot
      ↓
DSH 执行
```

推荐路径始终是调用官方 `codex login` 并让 Codex 保持 refresh ownership。复制 access token 只作为兼容旧部署的 fallback，不作为长期认证架构。

## 仓库结构

- `src/` — bridge runtime / CLI；
- `tests/` — runtime tests；
- `agent-presets/code-gpt/` — DSH 用户层 preset；
- `scripts/check-codex-health.ps1` — 旧 Windows 部署的体检脚本；
- `scripts/sync-codex-token.ps1` — legacy token-copy fallback；
- `docs/` — 安装与配置记录。

## 开发与验证

```bash
bun install
bun test
bunx tsc --noEmit
```

CI 负责 tests、TypeScript 检查以及 credential-like filenames 扫描。真实 OAuth、网络和 DSH/Codex 集成检查不会在 CI 中伪装执行。

完成官方登录后，可通过 CLI 检查状态：

```bash
codex login
bun src/cli.ts auth status
bun src/cli.ts doctor
```

具体 provider/model 名称属于 DSH / Codex 的版本兼容面，使用时应依据当前版本验证，不在本仓库中把某一组模型名称当作永久接口契约。

## 安全与凭据

- 不提交 `~/.codex/auth.json`、DSH credential files、token、cookie、`.env` 或代理密码；
- diagnostics / snapshots 优先记录状态与引用信息，不持久化可复用 credential；
- 公共日志和截图应隐藏用户名、home path、account identifier、private repo name 等无关信息；
- 详细规则见 [`SECURITY.md`](SECURITY.md)。

## 维护原则

1. **official auth ownership** — 登录与 refresh 仍由 Codex 负责；
2. **explicit failure** — 认证过期、代理故障、DSH 不兼容时应显式报错，不静默 fallback；
3. **minimal credential surface** — CLI、snapshot、测试和文档都不扩张 credential 暴露面。

更完整的 explainable multi-model routing 项目见 [DSHelm](https://github.com/Altairpaca/dshelm)。

MIT License.
