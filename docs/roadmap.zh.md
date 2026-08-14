# dsh-codex-bridge 可执行优化路线图

> **当前版本：PoC。** 本项目仍处于概念验证阶段：DSH 的主模型使用 openai-codex，Codex CLI/app-server 承担 subagent。当前通过同步 access_token 让主模型工作属于 **legacy fallback**，不是目标架构，也不应成为新的集成契约。

## 1. 项目定位与原则

本项目组合三项能力：**官方 Codex 登录**、DSH 的 **openai-codex 主模型**、以及官方 **Codex app-server subagent**。适配层只负责认证编排、代理传递、进程管理、诊断和测试；不重新实现服务端、不绕过授权、不绑定某个代理软件。

原则：官方优先、最小凭据、代理无厂商绑定、安全默认、可测试。

## 2. P0：认证与自动续签

### 2.1 认证 source 抽象

定义统一认证 source 接口：status、login、refresh、logout，以及仅在调用瞬间取得 access token 的 getAccessToken。优先使用 Codex app-server 的 account/read 或其他官方能力，其次调用官方 Codex CLI 能力；无法使用时读取官方格式 auth.json 作为 fallback；最后才允许旧版 DSH 凭据中的同步 access_token，且明确标记为 legacy fallback、只读、不承担自动续签。

fallback 读取必须校验 schema、文件权限、账户字段和 JWT exp（只解析元数据，不输出 token）。不得扫描未知路径、复制整个 auth.json 或将 refresh token 传入 prompt、日志和子代理。

### 2.2 状态机与刷新协议

状态机至少包含：UNKNOWN → NEED_LOGIN → VALID → EXPIRING → REFRESHING → VALID；刷新失败进入 REFRESH_FAILED，refresh token 失效/撤销进入 NEED_LOGIN，格式或权限问题进入 CORRUPT，网络/代理问题进入 UNAVAILABLE。所有状态转换记录脱敏 reason code。

- access token 在到期前按安全窗口刷新，默认提前 5 分钟，并处理时钟偏差。
- API 收到 401 时只允许一次 refresh + retry；再次 401 立即停止，不循环，并提示重新登录。
- 明确区分认证失败、refresh token 失效、代理/DNS/TLS、超时、服务端 4xx/5xx、文件损坏和协议版本错误。
- 支持 refresh token 轮换：新凭据成功落盘后才替换旧凭据，失败时保留仍可能有效的旧凭据。
- 进程内使用 single-flight 合并并发刷新；跨进程使用带 owner、超时和 stale lock 恢复的用户级锁。持锁后重新读取状态，避免重复刷新。
- 使用同目录临时文件、权限设置、flush/close、原子 rename 写入；崩溃不得留下半份凭据。持久化 schema 带版本号，支持迁移和安全拒绝未知版本。
- 时间统一 UTC；日志只保留过期时间/剩余秒数，禁止保留凭据原文。

### 2.3 P0 验收

新机器可用 auth login 完成官方登录，auth status 能解释状态；正常刷新、轮换、401 一次重试、并发刷新、进程崩溃写入恢复都有自动测试；工作树、构建产物和日志没有 token/session 文件；legacy fallback 明确显示为兼容模式。

## 3. P0/P1：代理友好

不硬编码 Clash、7897 或任何代理后端，不要求安装代理。支持 HTTPS_PROXY、HTTP_PROXY、ALL_PROXY、NO_PROXY（按平台合并大小写变量）。优先级为显式 CLI/项目配置 > 用户 DSH 配置 > 标准环境变量 > 直连；NO_PROXY 对匹配域名/IP 优先，代理失败不得静默降级直连。

HTTPS 目标经 HTTP proxy 使用 CONNECT 并验证两层 TLS；可选 SOCKS5/SOCKS5h，只有显式启用且依赖可用时提供。授权、refresh、主模型 API、Codex app-server 子进程统一使用同一代理解析结果；子进程只继承白名单环境变量。

支持企业 CA/trust store，默认验证证书，禁止以关闭 TLS 校验解决问题。分别设置连接、TLS、首字节、总超时和取消信号，限制重试并退避。错误需区分代理连接、DNS、TLS、目标服务和超时，并提供脱敏诊断。

提供 auth proxy show/set/unset 和 doctor。doctor 输出版本、平台、认证来源、代理解析结果、DNS/TLS/CONNECT 连通性、官方 CLI/app-server 可用性和文件权限，但不输出环境变量值、请求头、token、cookie、完整查询串或 session 内容。

代理验收：HTTP/HTTPS proxy、NO_PROXY、企业 CA、代理认证失败、连接超时、DNS 失败都有 mock/integration case；授权、refresh、API、app-server 走同一解析；无代理时直连可用；代码中无厂商或固定端口依赖。

## 4. P1：CLI/UX 与运行形态

统一命令：dsh auth login/status/refresh/logout、dsh doctor、dsh auth proxy show/set/unset；支持 account、json、no-browser、timeout 选项，JSON 输出稳定且脱敏。

Windows、Linux、macOS 使用平台路径和权限 API，不依赖 bash。文档覆盖 PowerShell、POSIX shell、SSH、容器和无头环境：SSH/容器支持一次性链接或设备码，无头模式不启动浏览器，凭据不写入镜像层。app-server 需要启动握手、协议版本检查、超时、优雅终止、stderr 脱敏、崩溃重启上限和 PID/会话关联；主模型与 subagent 可分别诊断。

## 5. P1：安全、多账户与 CI

默认单账户，但数据模型预留独立 profile：各自目录、锁、状态和过期时间，CLI 明确 current account，切换不混用 token。Unix 使用 0600，Windows 使用当前用户 ACL；拒绝不安全目录/符号链接或提供明确兼容开关。

日志、崩溃报告、telemetry、命令回显、环境快照和 app-server 输出统一脱敏；token 只允许出现在受控 Authorization header。CI 使用短期注入、外部 secret store 或官方无头能力；不提交 auth.json、session、cookie、token，不生成相关 artifact；提供只检查配置、不登录的 check 模式。危险操作需确认目标账户。

## 6. P2：测试、兼容性与可观测性

建立 mock OAuth/官方 account source、mock app-server、mock proxy 和可录制但脱敏的 HTTP fixture。覆盖多进程并发、锁超时、原子写入中断、时钟漂移、401/403/429/5xx、refresh 轮换、网络恢复、代理认证、证书链、Windows/Linux/macOS、SSH/容器/无头。

建立 contract tests 锁定官方 CLI/app-server 能力边界；版本不兼容时快速失败并提示升级，不猜测协议。指标只保留计数、耗时、状态码类别和 reason code，默认不上传请求内容或身份标识。

## 7. P0/P1/P2 交付顺序与验收

| 阶段 | 交付物 | 完成条件 |
|---|---|---|
| P0 | source 接口、status/login/refresh/logout、状态机、single-flight、跨进程锁、原子 schema、legacy fallback、脱敏错误 | 新安装可登录；刷新和 401 规则通过自动测试；旧同步方案可识别但不扩张 |
| P1 | 标准代理解析、CONNECT/HTTPS、可选 SOCKS、企业 CA、统一子进程环境、doctor、跨平台 CLI、无头/SSH/容器、多账户、CI、mock 测试 | 代理矩阵及四条链路通过；doctor 可定位且无泄密；账户隔离；CI 无 session artifact |
| P2 | contract/version tests、可观测性、迁移、性能和发布文档 | 官方能力变化可检测；升级/回滚有说明；全平台发布检查通过 |

每阶段先补测试和迁移说明，再实现功能；失败时不降级为泄露凭据或绕过 TLS 的兼容模式。

## 8. 暂不做事项

- 不实现或维护非官方 OAuth，不抓浏览器 cookie，不逆向私有 endpoint。
- 不绑定 Clash、7897、任何 VPN/代理厂商或专用守护进程。
- 不把同步 access_token 脚本升级成自动续签协议；它永远只是 legacy fallback，直到正式 source 取代。
- 不复制 Codex 模型路由、账单、权限系统或完整 app-server。
- 不支持长期静态 token、共享账户、向 subagent 暴露 refresh token、关闭证书校验或在 CI 保存 auth/session 文件。
- 不用真实账户、真实 token 或不可脱敏生产日志作为测试 fixture。

## 9. 发布前检查

- git diff --check 通过，变更仅包含本路线图文档；
- 扫描 diff、工作树和待提交文件：无 token、refresh token、cookie、session、auth.json 内容、私钥或代理认证信息；
- 示例只使用占位符；固定端口和厂商名仅作为禁止硬编码的反例；
- 远程为目标仓库、分支为 main，推送后核对 commit 和远程状态。
