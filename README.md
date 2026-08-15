# dsh-codex-bridge

让 [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) 使用 OpenAI GPT 模型 —— 通过 Codex / ChatGPT 登录认证,无需 OpenAI API Key。

这是一个面向 DSH 的 Codex bridge:保留 agent preset,并提供认证、代理、启动体检的 runtime CLI。当前自动续签仍依赖官方 Codex source,旧同步脚本仅作为 legacy fallback。

- `agent-presets/code-gpt/` — DSH agent preset:主对话模型走 GPT(openai-codex provider),并启用 Codex 子代理委托(`subagent_codex` 工具)
- `scripts/sync-codex-token.ps1` — 把 Codex 登录凭证(access token)同步到 DSH 凭证,供 DSH 的 LLM 路由使用
- `scripts/check-codex-health.ps1` — 兼容旧部署的一键体检
- `src/` / `package.json` — bridge runtime:登录状态、代理解析、启动门禁和安全 snapshot
- `docs/` — 安装与配置指南、部署对话实录

## 工作原理

DSH 内置的 `@deepseek-ai/dsh-llm-pi-ai` 适配器支持 pi-ai 的 **`openai-codex`** provider:它直连 `https://chatgpt.com/backend-api`(与 Codex CLI 相同的端点),使用 ChatGPT OAuth 的 access token 认证。因此:

1. 用 `codex login` 完成一次 ChatGPT OAuth 登录(浏览器授权)
2. 把 `~/.codex/auth.json` 中的 `access_token` 提供给 DSH(通过本项目的 sync 脚本写入 `~/.dsh/.credentials.yaml`)
3. 在 `~/.dsh/settings.yaml` 注册 `openai-codex` provider 并设为默认模型
4. 使用本 preset 的 agent:主对话由 GPT 驱动,并可把子任务委托给 `codex`(通过官方 `@deepseek-ai/dsh-subagent-codex` 包)

无需 API Key、按 ChatGPT 订阅额度计费。

## 前置条件

- 已安装 [Codex CLI](https://github.com/openai/codex)(`codex --version`)并完成 `codex login`
- 已安装 DSH(`dsh --version`)
- 网络可访问 `chatgpt.com`(中国大陆用户需配置代理,见 `docs/`)

## 安装

### 1. 放置 preset

把 `agent-presets/code-gpt/` 复制到你的 DSH 用户 preset 目录:

```powershell
Copy-Item -Recurse agent-presets/code-gpt "$HOME\.dsh\.agent-presets\code-gpt"
```

### 2. 登录与状态

优先使用 bridge CLI 调用官方 Codex 登录：

```powershell
bun src/cli.ts auth login
bun src/cli.ts auth status
bun src/cli.ts doctor
```

当前 CLI 会调用官方 `codex login`，并以只读方式读取登录状态；自动 refresh source 尚在建设中。旧部署可暂时使用 `scripts/sync-codex-token.ps1`，但它只同步 access token，属于 legacy fallback。

### 3. 注册 provider 并设为默认

在 `~/.dsh/settings.yaml` 中:

```yaml
agent-presets:
  default: code-gpt
agent-default-model:
  provider: openai-codex
  model: gpt-5.6-sol
llm-pi-ai:
  providers:
    openai-codex:
      apiKeyEnv: CODEX_ACCESS_TOKEN
```

可用模型:`gpt-5.6-sol` / `gpt-5.6-terra` / `gpt-5.6-luna` / `gpt-5.5` / `gpt-5.4` 等。

### 4. 注册 Codex subagent provider(宿主组合)

在 DSH 的宿主组合(profile 的 `cordis.patch.yml`)中追加:

```yaml
- insert:
    - id: subagent-codex
      name: '@deepseek-ai/dsh-subagent-codex'
      config:
        env:
          # 代理由标准 HTTPS_PROXY/HTTP_PROXY/ALL_PROXY 按需提供
          # 不要求 Clash、固定端口或特定代理后端
```

并安装 provider 包:`bun add -g @deepseek-ai/dsh-subagent-codex`(需与你的 DSH 版本匹配的 rc 版本)。

### 5. 体检(可选但推荐)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-codex-health.ps1
```

输出全部 `OK` 即链路健康;有 `WARN`/`FAIL` 按提示修复。常见问题:设置代理后**未从新终端重启 DSH**(宿主进程不会继承 setx 变量)、补丁写入后未重启宿主。

### 6. 重启 DSH

新会话将默认使用 `code-gpt` 预设:主对话模型为 GPT,模型选择器中可见全部 GPT 模型,并可使用 `subagent_codex` 工具委托 Codex。

## 对 DSH 社区的贡献说明

- 本项目不修改 DSH 或其任何 shipped 组件;只提供 *用户层* 配置与预设(符合 DSH 的 agent-presets 设计)
- preset 是 shipped `code` 预设的副本,仅启用了 `tool-subagent-codex` 行,其余保持一致
- Codex provider(`openai-codex` LLM 路由、`@deepseek-ai/dsh-subagent-codex` subagent)均为 DSH 官方能力,本项目只负责把它们接起来

## 许可证

MIT — 见 [LICENSE](LICENSE)。
