# 部署对话实录(迁移自 DSH 会话)

> 本文档把 **"DSH 使用 OpenAI GPT(Codex 登录认证)"** 的原始部署对话迁移到本仓库,
> 作为可追溯的部署记录。来源:DSH 会话导出包
> `dsh-session-session-1485bd35-a9fc-4606-8714-2da9a62da2f4.zip`
> (会话 `session-1485bd35`,创建于 2026-08-14 23:12,cwd `D:\保险`,agent preset `code`)。
> 迁移时间:2026-08-15。

---

## 1. 会话背景与目标

用户原话(摘录):

> 我希望配置codex登录以使用GPT模型,为我进行配置
> 重申一下我的目标:我希望可以在DSH里面使用GPT模型,可以通过Codex登录的方式,
> 然后把OpenAI作为一个provider使用,而不是单独调用codex
> 如果是codex正常配置代理以及作为subagent,这个也是我同样需要的能力
> 两个要一起做

即两条交付线:

1. **主对话模型走 GPT**:DSH 通过 `openai-codex` provider(pi-ai 内置,直连
   `https://chatgpt.com/backend-api`)使用 ChatGPT OAuth access token 认证,无需 API Key;
2. **Codex 子代理**:把子任务委托给 `codex` CLI(通过 `@deepseek-ai/dsh-subagent-codex`
   在宿主组合注册 `codex` provider,preset 暴露 `subagent_codex` 工具)。

---

## 2. 部署时间线(按实际执行顺序)

### 阶段 A:安装 Codex CLI 并登录(2026-08-14 23:12 起)

| 步骤 | 动作 | 结果 |
|---|---|---|
| A1 | 探测环境:codex 未安装;npm/node/bun 可用 | 安装前 codex 命令不存在 |
| A2 | `npm install -g @openai/codex`(后台) | 长时间无进展,被用户叫停 |
| A3 | 用户建议:**改用 bun**(`bun add -g @openai/codex`) | ✅ 成功,`codex-cli 0.147.0` |
| A4 | `codex login status` → 未登录 | 触发登录流程 |
| A5 | 询问用户登录方式 → 选 **ChatGPT 账号登录 (Recommended)** | 浏览器 OAuth |
| A6 | `codex login`(后台,浏览器授权) | ✅ `Logged in using ChatGPT`,`~/.codex/auth.json` 生成 |
| A7 | `codex debug models` 导出模型目录 | 确认可用模型 gpt-5.6-sol / terra / luna 等 |

### 阶段 B:网络代理配置(中国大陆必需)

- 发现本机代理:Clash Verge(混合端口 **7897**),扫描了 7890/7891/1080/7897 等常用端口;
- 经代理测试 `chatgpt.com/backend-api/models` 可达(浏览器 UA 通过);
- 写入用户级环境变量(持久化,后续所有新进程继承):

```powershell
setx HTTPS_PROXY "http://127.0.0.1:7897"
setx HTTP_PROXY  "http://127.0.0.1:7897"
setx ALL_PROXY   "http://127.0.0.1:7897"
setx NO_PROXY    "localhost,127.0.0.1,::1"
setx NODE_USE_ENV_PROXY "1"   # 关键:node fetch/WebSocket 才读代理环境变量
```

- 写入 `~/.codex/config.toml`:

```toml
model_provider = "openai"
model = "gpt-5.6-sol"
```

### 阶段 C:打通 DSH 主对话 GPT provider

1. **发现**:pi-ai(`@earendil-works/pi-ai` 0.82.1,DSH profile 内置)自带
   `openai-codex` provider(`dist/providers/openai-codex.js`),OAuth-only;
2. **凭证**:把 `~/.codex/auth.json` 的 `tokens.access_token` 写入
   `~/.dsh/.credentials.yaml` 的 `CODEX_ACCESS_TOKEN`;
3. **注册 provider**(`~/.dsh/settings.yaml`):

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

> 注意:dsh-llm-pi-ai 对 OAuth-only 的 catalog provider 会附加 harness 侧
> api-key auth(`routeAuth` 逻辑),因此 `apiKeyEnv` 对 `openai-codex` 有效,
> 无需 provider 原生支持 apiKey。

### 阶段 D:code-gpt preset(主对话 + subagent_codex 工具)

- 复制 shipped `code` preset → `~/.dsh/.agent-presets/code-gpt`;
- 在 `delegation` 组新增一行(唯一与 `code` 的差异):

```yaml
- id: tool-subagent-codex
  name: '@deepseek-ai/dsh-tool-subagent'
  config:
    provider: codex
    toolName: subagent_codex
    enableRunInBackground: false
    maxDepth: provider-managed
```

- `preset.yml` 命名"PTC 模式 (GPT + Codex 子代理)"。

### 阶段 E:宿主组合注册 subagent-codex provider

- `bun add -g @deepseek-ai/dsh-subagent-codex@0.1.0-rc.6`
  (首次尝试 exit 1,重试后成功;版本须与 DSH rc 匹配);
- `~/.dsh/profiles/web/cordis.patch.yml` 追加:

```yaml
- insert:
    - id: subagent-codex
      name: '@deepseek-ai/dsh-subagent-codex'
      config:
        env:
          HTTPS_PROXY: http://127.0.0.1:7897
          HTTP_PROXY: http://127.0.0.1:7897
          ALL_PROXY: http://127.0.0.1:7897
```

> `env` 显式传给 `codex app-server --stdio` 子进程,保证子代理能连 ChatGPT,
> 不依赖宿主进程环境。

### 阶段 F:同步脚本与验证

- 编写 `scripts/sync-codex-token.ps1`(本仓库当前版本);
  迭代中解决了 PowerShell 读 `auth.json` 的编码/转义问题;
- 验证:
  - ✅ 独立进程 GPT 调用成功(pi-ai provider + CODEX_ACCESS_TOKEN + 代理);
  - ✅ `code-gpt` preset 挂载验证通过(cordis 插件 `verify-gpt-setup`);
  - ✅ provider 注册验证通过;
  - ⚠️ 期间踩到 Cordis Host guard:`service "agentDefaultModel" is not injected`,
    临时验证插件补 `inject: ['agentDefaultModel', …]` 后通过(仅测试代码,非交付物)。

### 阶段 G:发布到 GitHub(2026-08-14 ~23:30 起,会话 turn 3)

用户要求:

> 当前这个插件能否发布到我的Github repo,作为一个保险项目之外的独立代码,然后贡献到DSH社区?
> …我建议放在D:/code里面单独创建一个放repo的地方,git 信息 name 是 Altair Li,邮箱是 altairpaca@gmail.com

- `gh` CLI 已登录(`Altairpaca`,repo 权限);`git --version` 正常;
- 创建 `D:\code\dsh-codex-gpt`(与 D:\保险 完全隔离),整理 7 个文件:
  README.md / LICENSE(MIT)/ .gitignore / agent-presets/code-gpt/* / docs/install-guide.zh.md / scripts/sync-codex-token.ps1;
- `git init` → 仓库级 `git config user.name "Altair Li"` / `user.email "altairpaca@gmail.com"`;
- `gh repo create dsh-codex-gpt --public --source . --remote origin …`;
- 分支改为 `main` 并 `git push -u origin main` → ✅ 发布成功;
- 敏感信息扫描:仓库零真实 token(`.credentials.yaml`/`auth.json` 已 gitignore)。

---

## 3. 踩坑记录(供复现时参考)

| # | 坑 | 处理 |
|---|---|---|
| 1 | `npm i -g @openai/codex` 卡住 | 改用 `bun add -g @openai/codex` |
| 2 | `codex whoami` 报 `stdin is not a terminal` | 非交互环境正常现象;用 `codex login status` 判断登录 |
| 3 | node fetch/WebSocket 不读 `HTTPS_PROXY` | 必须 `setx NODE_USE_ENV_PROXY 1` 并**重启宿主进程** |
| 4 | `setx` 只影响新进程 | 已运行的 DSH 宿主不会获得新变量,必须重启,且从**新开终端**启动 |
| 5 | cordis.patch.yml 在宿主启动后才写入 | 宿主组合只在启动时加载,补丁需重启才生效 |
| 6 | `bun add -g @deepseek-ai/dsh-subagent-codex` 首次 exit 1 | 重试(网络/代理波动),版本须与 DSH rc 匹配 |
| 7 | Cordis guard:`agentDefaultModel is not injected` | 验证插件 inject 补全(仅影响测试插件) |
| 8 | token 约 10 天过期 | 过期后重跑 `sync-codex-token.ps1` 或重新 `codex login` |

---

## 4. 原始会话给出的后续改善建议(优先级排序)

1. **token 自动刷新**:sync 脚本加 `--daemon` 模式,用 refresh_token 后台续期
   (pi-ai 的 openai-codex OAuth 已实现 refresh,可借鉴);
2. **跨平台**:补 POSIX 版 `sync-codex-token.sh`;
3. **CI 校验**:GitHub Actions 对 preset 做挂载校验;
4. **代理可配置**:README 示例硬编码 `127.0.0.1:7897`,应说明如何适配其他代理。

---

## 5. 迁移后记:2026-08-15 复查发现的问题

部署后当天复查发现两处**宿主未重启导致**的问题(详见 `install-guide.zh.md` 故障排查与
`scripts/check-codex-health.ps1`):

1. `setx` 代理变量(23:33/00:13 写入)晚于宿主启动(23:11),宿主进程环境无
   `HTTPS_PROXY`/`NODE_USE_ENV_PROXY` → DSH 内 `openai-codex` 主对话请求
   直连 chatgpt.com 失败(TRANSPORT);
2. `cordis.patch.yml`(00:04 写入)晚于宿主启动 → `subagent-codex` provider
   未注册 → `subagent_codex` 工具缺失。

**修复**:从新开的终端(环境含代理变量)重启 `dsh web` 即可同时解决;
codex CLI 登录本身正常(access_token 有效期至 2026-08-24)。

> 相关会话 `session-1b85ec44`(导出包 `dsh-session-session-1b85ec44-….zip`)
> 是"云助理客户信息整理"会话,与本部署无关,未迁移。
