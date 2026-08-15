# 安装与配置指南

本指南把 dsh-codex-bridge 的登录、代理、启动和 DSH 集成拆成可复现清单。当前 runtime CLI 优先调用官方 Codex 登录；旧 PowerShell 同步脚本仅作为 legacy fallback。路径示例基于 Windows，macOS/Linux 需按平台调整命令。

## 0. 前置条件

| 项 | 检查命令 | 说明 |
|---|---|---|
| Codex CLI | `codex --version` | 未安装则 `bun add -g @openai/codex` 或 `npm i -g @openai/codex` |
| Codex 登录 | `codex login status` | 需输出 `Logged in using ChatGPT` |
| DSH | `dsh --version` | 当前开发版 `0.1.0-rc.x` |
| 网络 | `codex doctor` | 中国大陆用户需代理,见下节 |

## 1. 网络代理（按需）

Codex 与 DSH 的 `openai-codex` provider 都要访问 `chatgpt.com`。bridge 不要求任何代理软件，支持标准 `HTTPS_PROXY`、`HTTP_PROXY`、`ALL_PROXY`、`NO_PROXY`，也可以通过 CLI 或 `~/.dsh/codex-bridge/config.json` 配置。以下仅是通用示例，地址和协议由用户代理后端决定：

```powershell
$env:HTTPS_PROXY = "http://proxy.example:8080"
$env:HTTP_PROXY  = "http://proxy.example:8080"
$env:ALL_PROXY   = "http://proxy.example:8080"
$env:NO_PROXY    = "localhost,127.0.0.1,::1"
# 不使用代理时清除这些变量即可；bridge 不自动修改系统环境。
```

bridge 会诊断宿主是否继承代理变量；具体 Node/DSH 版本若需要 `NODE_USE_ENV_PROXY=1`，可在启动前显式设置，但这不是某个代理后端的硬性要求。

设置后**必须重启 DSH**(宿主进程启动时已捕获环境变量,运行中不会热更新),且**要从新打开的终端启动**:`setx` 只影响新进程,已运行的终端与宿主进程不会获得新变量。

```powershell
# 1) 关闭当前 dsh web(关掉运行它的终端/Ctrl+C)
# 2) 新开一个终端,确认变量已生效:
echo $env:HTTPS_PROXY        # 应输出你配置的代理 URL（无代理可为空）
echo $env:NO_PROXY            # 应包含 localhost/127.0.0.1（如适用）
# 3) 重启:
dsh web
```

## 2. 登录、状态与启动体检

```powershell
bun src\cli.ts auth login
bun src\cli.ts auth status
bun src\cli.ts doctor --json
```

登录由官方 `codex login` 完成。当前 auth-json source 是只读兼容路径，不保存 refresh token；自动续签 source、启动门禁和 DSH 动态 credential hook 将按 `docs/roadmap.zh.md` 完成。旧环境仍可使用 `scripts\sync-codex-token.ps1`，但过期后必须手工同步。

## 3. 安装 preset

```powershell
Copy-Item -Recurse agent-presets\code-gpt "$HOME\.dsh\.agent-presets\code-gpt"
```

`code-gpt` 是 shipped `code` preset 的副本,唯一区别是启用了 `tool-subagent-codex`(Codex 子代理委托工具)。它同时保留 Code Mode(`tool-presentation: mode: code`)。

## 4. 配置 settings.yaml

编辑 `~/.dsh/settings.yaml`:

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

- `agent-default-model` 是新建会话的默认模型;`openai-codex` 是 pi-ai 内置 provider,直连 `https://chatgpt.com/backend-api`
- 可用模型(2026-08 目录):`gpt-5.6-sol`(前沿)、`gpt-5.6-terra`(均衡)、`gpt-5.6-luna`(快/省)、`gpt-5.5`、`gpt-5.4`、`gpt-5.4-mini`
- Web 界面"模型选择"中也会列出这些模型,可随时切换

## 5. 注册 Codex subagent provider(宿主组合)

安装 provider 包(版本需与 DSH rc 匹配):

```powershell
bun add -g @deepseek-ai/dsh-subagent-codex
```

在 DSH profile 的宿主组合(web 为 `~/.dsh/profiles/web/cordis.patch.yml`)追加:

```yaml
- insert:
    - id: subagent-codex
      name: '@deepseek-ai/dsh-subagent-codex'
      config:
        env:
          # 由 bridge 解析后的标准代理变量按需传入；不要硬编码厂商或固定端口
```

`env` 显式传给 `codex app-server --stdio` 子进程,保证子进程能连 ChatGPT(不依赖宿主进程环境)。

## 6. 重启并验证

1. 重启 DSH(web 服务)
2. 新开会话 → 默认使用 `code-gpt` 预设、默认模型 `openai-codex / gpt-5.6-sol`
3. 验证模型路由:
   - Web 模型选择器应显示全部 GPT 模型
   - 发送一条消息,回复由 GPT 生成
4. 验证 subagent:让模型使用 `subagent_codex` 工具委托一个子任务

## 一键体检

链路出问题时先跑体检脚本,按输出的 FAIL/WARN 逐项修复:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\check-codex-health.ps1
# 换代理端口: ... -ProxyPort 7890
```

检查项:codex CLI 安装与登录、access_token 过期时间、凭证与 auth.json 一致性、
代理端口可达性、当前进程代理环境(提示宿主是否需重启)、subagent-codex 组件。

## 故障排查

| 症状 | 原因 | 处理 |
|---|---|---|
| `TRANSPORT` / `fetch failed` | 代理未被当前进程继承、代理协议不匹配或 TLS/CA 错误 | 运行 `bun src\cli.ts doctor --json`，检查标准代理变量、NO_PROXY、企业 CA 和启动进程 |
| GPT 模型报错但 `codex exec` 正常 | DSH 宿主和 Codex CLI 使用了不同的代理解析 | 使用同一份 bridge 配置并重启宿主，分别运行 `doctor` 检查主模型与 subagent |
| `subagent_codex` 工具缺失 | `cordis.patch.yml` 写入晚于宿主启动,补丁未加载 | 重启宿主(补丁只在启动时加载) |
| `401` / 凭证过期 | access_token 过期 | 重跑 `sync-codex-token.ps1` |
| 模型选择器无 GPT | settings.yaml 的 `llm-pi-ai.providers` 缺失 | 检查第 4 节配置 |
| `subagent_codex` 工具缺失 | 宿主未注册 `subagent-codex` 行或未装包 | 检查第 5 节,重启 DSH |
| `Failed to extract accountId` | token 不是有效的 ChatGPT JWT | 重新 `codex login` |
