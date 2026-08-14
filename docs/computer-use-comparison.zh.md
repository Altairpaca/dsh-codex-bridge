# DSH Computer Use:社区现状对比与改进方案

> 背景:2026-08-15 会话 `session-2ac9a09e`("云助理客户信息整理"实验,导出包
> `dsh-session-session-2ac9a09e-….zip`)暴露了当前 computer use 实现的核心问题
> (坐标"识别偏上、行为偏下"、点错入口、反复人工校准)。本文对比社区已有的
> DSH 适配 computer use / vision 插件,定位我们实现的差距,给出可落地的改进路线。
> 撰写时间:2026-08-15。

---

## 1. 我们当前的实现是什么

"我们的 computer use"目前**不是插件**,而是会话内由 Agent 现场生成的
PowerShell 桥 + Code Mode SDK 工具暴露:

- 实现文件:`%TEMP%\dsh-cu\cu.ps1`(临时目录,重启即丢,不可复用);
- 工具面(`run_code` 的 `tools.computer_*`):
  `computer_screenshot` / `computer_ocr` / `computer_vision` / `computer_mouse` /
  `computer_keyboard` / `computer_use_run`;
- 技术栈:
  - 截图:全虚拟屏 `CopyFromScreen`(实验时为 1707×1067,即 150% 缩放显示器的逻辑分辨率),附缩略图;
  - OCR:WinRT `Windows.Media.Ocr`(zh-Hans-CN),返回逐词坐标 `x/y/w/h/cx/cy`,支持 query 匹配;
  - 视觉:`mimo-v2.5`(opencode.ai/zen/go 端点,`OPENCODE_GO_API_KEY`),base64 图片 + 可选 OCR 文本提示;
  - 输入:user32 `SetCursorPos` + `mouse_event` / `keybd_event`,支持 move/click/double/right/scroll/drag/type/hotkey。

## 2. 实验暴露的问题(来自会话日志)

| # | 现象 | 根因(从日志推理) |
|---|---|---|
| 1 | 点进"月拜访客户"而非"孤单客户数",反复 | 目标窗口是 Chromium 应用(`Chrome_WidgetWin_1`)内嵌的 ~400px 手机视图;Agent 把窗口拉大到 1700×1030 后**内容没有重排**,模型按放大后布局推断坐标必然错位(日志:OCR "孤单客户"@(384,256) 而点击 (440,256);"孤单客户数"@(82,359) 而点击 (150,400)) |
| 2 | "识别偏上、行为偏下",偏差约 30–60px | (a) 全屏截图含**其他窗口文字**(DSH Chrome、Edge、任务栏),OCR/VLM 被无关文本干扰;(b) VLM(mimo-v2.5)对全屏图直接报坐标,gounding 系统性偏上;(c) 裁剪后 OCR 的坐标**未回加裁剪偏移**(如 crop 起点 (16,5),点击却直接用裁剪内坐标) |
| 3 | 窗口句柄失效(264750 → 1181976) | Agent 硬编码 `MainWindowHandle`,重登录/重建窗口后句柄变化;无按标题/进程动态查找 |
| 4 | 点击落在错误窗口 | 窗口未置前台(DSH 的 Chrome 在最上层),无 `GetForegroundWindow` 校验就点击 |
| 5 | 每次点击都是盲试 | 无"点击→截图→OCR 验证→失败重试(±偏移)"闭环;整个流程靠 Agent 手工多轮实验,26 分钟内 58 次截图 + 63 次 OCR + 44 次鼠标 |
| 6 | vision 通道不稳定 | `computer_vision` 偶发返回空;VLM 以自由文本描述坐标,无结构化 box、无标注回看 |
| 7 | 不可复用 | cu.ps1 在 Temp 目录,无安装、无版本、无权限控制,无法贡献社区 |

## 3. 社区已有方案(2026-08 检索)

### 3.1 直接相关的 DSH computer use 插件

**[Anionex/dsh-computer-use](https://github.com/Anionex/dsh-computer-use)**(⭐,macOS 14+,"目前支持 macos")
- 唯一一个以"Computer Use for DSH"为名发布的官方形态插件(bundle row `@anionex/dsh-computer-use` + Skill);
- 设计要点:Accessibility-first(读 AX 树、元素索引 + 不透明 `targetHandle`,**按元素点击而非坐标**)、
  observation TTL / **过期状态拒绝**、每次动作**返回新观测作为验证**、pid/window 定向输入、
  作用域权限(按 Agent/Session/回合/ bundle id 发放读写租约)、默认不抢焦点/不动系统光标(独立 Agent 光标)。
- 配套 **[Anionex/dsh-vision-toolkit](https://github.com/Anionex/dsh-vision-toolkit)**(⭐308):图片问答、长截图 OCR、UI 还原、grounding、pixel diff、Artifacts、Web UI。

### 3.2 DSH vision 插件(可替换我们的视觉通道)

| 项目 | 要点 |
|---|---|
| [tdf1995/dsh-plugin-vision](https://github.com/tdf1995/dsh-plugin-vision) | `see_image` 工具;Gemini(`gemini-3.6-flash`)+ 智谱 GLM(`glm-4.6v-flash` 免费直连)双通道故障转移;npm 包 + `cordis.patch.yml`,纯 JS |
| [ysr666/dsh-vision-router](https://github.com/ysr666/dsh-vision-router) | 内置**免 key** 视觉链(Qwen2.5-VL-72B,OVH 匿名端点);`vision_ground`(原像素包围盒)、`vision_detect`(编号元素框)、`vision_crop`、`vision_pixel_diff`、`vision_ocr`(tesseract);无 Python |
| [liustack/modlens](https://github.com/liustack/modlens)(⭐1208) | 图片→OCR/布局/语义结构化 JSON 证据,纯文本模型可靠看图;生态内 Star 最高 |
| dsh-plugin-deepeye(npm) | 视觉问答类 |

### 3.3 Windows 原生 computer use 参考(非 DSH,但同为 Windows 目标平台)

**[ezpzai/codex-computer-use-windows](https://github.com/ezpzai/codex-computer-use-windows)**(SKILL.md)
- **UI Automation 优先**(`get_ui_tree` / `find_and_click_element` / `get_window_text`,Python `uiautomation` 包),截图/OCR 仅作降级;
- `observe_screen(include_screenshot=False, include_ui_tree=True)` 省 token;
- `focus_window`(AttachThreadInput fallback)、`screenshot_active_window`(窗口级截图)、`batch_actions`(一次调用多动作)、`expected_window` 前台失配检测;
- OCR 用 Windows 内置引擎——与我们 cu.ps1 同源技术,但**坐标使用方式**更严谨。

> 另注:官方 deepseek-harness 本体不内置 computer use;社区插件生态庞大
> (awesome-dsh-plugin 收录 1761 仓库,视觉分类见
> [awesome-dsh-plugin](https://github.com/bruc3van/awesome-dsh-plugin)),但没有
> **Windows 版**的 DSH computer use 插件 —— 这是一个空白,也是我们的机会。

## 4. 对比:我们的 vs 社区

| 维度 | 我们的 cu.ps1 方案 | Anionex(理想形态) | ezpzai Windows 配方 |
|---|---|---|---|
| 平台 | Windows ✅ | 仅 macOS | Windows(非 DSH) |
| 感知 | 全屏截图 + WinRT OCR + VLM 问答 | AX 语义树 + 截图 artifact | UIA 树 + 截图 + OCR |
| 定位方式 | VLM/OCR **估坐标** | 元素索引 + targetHandle(**按元素**) | find_and_click_element(**按元素**) |
| 点击验证 | 无,靠手工再截图 | 每次动作返回 fresh observation | SKILL 约束"动作后必验证" |
| 窗口管理 | 硬编码句柄,手工 Add-Type | 精确 process/window 绑定 | focus_window + 失配检测 |
| 焦点/安全 | 强抢前台,无权限控制 | 不激活后台操作 + scope 租约 | 部分 |
| 状态过期拒绝 | 无 | 有(TTL) | 无 |
| 交付形态 | 临时脚本,不可复用 | bundle + Skill,可安装 | SKILL.md |
| 视觉模型 | mimo-v2.5(付费 opencode-go,不稳) | 配套 vision-toolkit | Windows OCR |

**结论:我们的差距不在"能用"而在"可靠"** —— 坐标来源、验证闭环、窗口绑定、
交付形态四个环节全部弱于社区成熟方案;而这四点正是实验失败的四个直接原因。

## 5. 改进路线(可行性判断:全部可做,成本递增)

### 方案 A:就地改造 cu.ps1(推荐第一步,1–2 天)

不改架构,只补五个能力,直接消灭实验中的四类错误:

1. **窗口级截图与坐标归一**:
   - `screen --window <hwnd|title>`:按 `GetWindowRect` 只截目标窗口(或裁剪后返回 `offset_x/offset_y`);
   - OCR 词坐标一律转**窗口局部坐标**,点击时由工具回加窗口偏移;OCR 结果自动丢弃窗口外词
     (消灭"把 DSH Chrome 的文字当目标应用文字"与"裁剪偏移未回加");
   - `window list/focus/rect` 子命令:按标题/进程动态查找句柄(消灭硬编码句柄);
   - `focus` 用 `SetForegroundWindow` + `AttachThreadInput` fallback(借鉴 ezpzai),点击前校验
     `GetForegroundWindow == 目标`,不符则拒绝并提示。
2. **文字点击原语**:`mouse --action click_text --text 孤单客户数` → 内部 OCR 匹配词中心再点击,
   近似匹配 + 命中报告。**模型不再需要自己算坐标**(消灭 VLM 估坐标这一最大误差源)。
3. **点击验证闭环**:click → 截图 → OCR 检查 `expect_text` 出现/消失 → 失败按 ±5/±10/±20px
   网格重试 → 仍失败返回带证据的失败。等价于 Anionex 的"verified post-action state"的简化版。
4. **DPI 校准**:进程内 `SetProcessDpiAwareness(PerMonitorV2)` 统一物理/逻辑坐标;
   或提供 `calibrate` 子命令(点击已知网格点→截图→像素检测光标→算 offset 并持久化)。
5. **vision 通道替换**:`computer_vision` 换成免费可故障转移的链(GLM `glm-4.6v-flash`
   或 dsh-vision-router 的免 key 链),并要求 **JSON 包围盒输出**(`{x1,y1,x2,y2}`),
   由脚本画框生成标注图后再回看验证(grounding + 回看,UI-TARS/OmniParser 标准做法)。

### 方案 B:移植 Anionex 架构到 Windows(中期,1–2 周)

把 dsh-computer-use 的四个设计移植过来,底层换成 Windows 等价物:

- 语义层:UIAutomation(pwsh 可通过 .NET Windows Compatibility Pack
  `Add-Type -AssemblyName UIAutomationClient`,或 Python `uiautomation` 包);
  cu.ps1 保留作 pointer/OCR fallback(即 Anionex 的"语义优先、指针降级"结构);
- observation TTL + 过期状态拒绝(每次动作绑定一个未过期的观测 id);
- 动作后返回新观测(验证闭环升级为协议级);
- 交付形态:正式 bundle(`cordis.patch.yml` 一行挂载 + Skill),按
  `@yourname/dsh-computer-use-windows` 发布到 npm,填补社区 Windows 空白。

### 方案 C:直接集成现成插件(0.5 天,可与 A 并行)

- 视觉通道换 [dsh-plugin-vision](https://github.com/tdf1995/dsh-plugin-vision)(免费 GLM/Gemini)
  或 [dsh-vision-router](https://github.com/ysr666/dsh-vision-router)(免 key + grounding 工具族),
  不再维护自己的 vision 调用;
- cu.ps1 只保留 screen/ocr/mouse/keyboard 四个能力 + 方案 A 的验证闭环。

## 6. 建议

1. **先做方案 A**(就地改造,立即让"云助理"这类任务可自动化,不再需要人工盯着纠正坐标);
2. **并行做方案 C**(视觉通道免费化 + grounding);
3. 若要把 computer use 作为**社区贡献**(与 dsh-codex-gpt 同路线),做方案 B:
   Windows 版语义优先 computer use 目前是 DSH 生态空白,按 Anionex 的 bundle+Skill
   格式包装发布,复用本仓库的 preset/README/发布流程。

---

## 附:关键参考链接

- 实验会话导出:`D:/Download/dsh-session-session-2ac9a09e-d9aa-4b02-bb5a-3c6f621ab2eb.zip`
- 当前实现:`%TEMP%\dsh-cu\cu.ps1`
- [Anionex/dsh-computer-use](https://github.com/Anionex/dsh-computer-use)(macOS)
- [Anionex/dsh-vision-toolkit](https://github.com/Anionex/dsh-vision-toolkit)
- [tdf1995/dsh-plugin-vision](https://github.com/tdf1995/dsh-plugin-vision)
- [ysr666/dsh-vision-router](https://github.com/ysr666/dsh-vision-router)
- [liustack/modlens](https://github.com/liustack/modlens)
- [ezpzai/codex-computer-use-windows](https://github.com/ezpzai/codex-computer-use-windows)(Windows 参考配方)
- [bruc3van/awesome-dsh-plugin](https://github.com/bruc3van/awesome-dsh-plugin)(生态目录)
