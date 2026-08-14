# check-codex-health.ps1
# DSH + Codex/GPT 链路一键体检:
#   1. Codex CLI 安装与版本
#   2. codex 登录状态 (ChatGPT OAuth)
#   3. access_token 存在性与过期时间 (JWT exp)
#   4. DSH 凭证 CODEX_ACCESS_TOKEN 与 auth.json 是否一致
#   5. 代理端口可达性 (Clash Verge 默认 7897, 可用 -ProxyPort 覆盖)
#   6. 当前进程环境中的代理变量 (DSH 宿主需重启后才会继承 setx 的变量)
#   7. subagent-codex 包与宿主补丁文件检查
#   8. 结论与修复建议
#
# 用法:
#   powershell -ExecutionPolicy Bypass -File scripts\check-codex-health.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\check-codex-health.ps1 -ProxyPort 7890

param(
    [int]$ProxyPort = 7897
)

$ErrorActionPreference = 'Continue'
$ok = 0; $warn = 0; $fail = 0
function Report([string]$status, [string]$msg) {
    switch ($status) {
        'OK'   { $script:ok++;   Write-Host ('  [OK]   ' + $msg) -ForegroundColor Green }
        'WARN' { $script:warn++; Write-Host ('  [WARN] ' + $msg) -ForegroundColor Yellow }
        default { $script:fail++; Write-Host ('  [FAIL] ' + $msg) -ForegroundColor Red }
    }
}

Write-Host "==== DSH + Codex/GPT 链路体检 ====" -ForegroundColor Cyan
Write-Host ('时间: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
Write-Host ""

Write-Host "1) Codex CLI" -ForegroundColor Cyan
$codex = Get-Command codex -ErrorAction SilentlyContinue
if ($codex) {
    $v = (& codex --version 2>&1 | Select-Object -First 1)
    Report 'OK' ('codex 已安装: ' + $v + ' (路径: ' + $codex.Source + ')')
} else {
    Report 'FAIL' 'codex 未安装。修复: bun add -g @openai/codex'
}

Write-Host ""
Write-Host "2) Codex 登录状态" -ForegroundColor Cyan
$loginOut = (& codex login status 2>&1 | Out-String)
if ($loginOut -match 'Logged in using ChatGPT') {
    Report 'OK' '已登录 (ChatGPT OAuth)'
} elseif ($loginOut -match 'Not logged in|logged out') {
    Report 'FAIL' '未登录。修复: codex login (浏览器授权)'
} else {
    Report 'WARN' ('无法判断登录状态: ' + ($loginOut.Trim() -split [Environment]::NewLine)[0])
}

Write-Host ""
Write-Host "3) access_token 有效性" -ForegroundColor Cyan
$authPath = Join-Path $env:USERPROFILE '.codex\auth.json'
if (Test-Path $authPath) {
    $auth = Get-Content $authPath -Raw | ConvertFrom-Json
    $token = $auth.tokens.access_token
    if ($token) {
        $parts = $token.Split('.')
        if ($parts.Length -ge 2) {
            $b64 = $parts[1].Replace('-', '+').Replace('_', '/')
            switch ($b64.Length % 4) { 2 { $b64 += '==' } 3 { $b64 += '=' } }
            try {
                $json = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b64)) | ConvertFrom-Json
                $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
                $remainH = [math]::Round(($json.exp - $now) / 3600, 1)
                if ($json.exp -gt $now) {
                    Report 'OK' ('token 有效, 剩余约 ' + $remainH + ' 小时 (过期: ' + [DateTimeOffset]::FromUnixTimeSeconds([int64]$json.exp).LocalDateTime.ToString('yyyy-MM-dd HH:mm') + ')')
                } else {
                    Report 'FAIL' 'token 已过期。修复: 重跑 sync-codex-token.ps1 或 codex login'
                }
            } catch {
                Report 'WARN' ('JWT 解析失败: ' + $_.Exception.Message)
            }
        } else {
            Report 'WARN' 'token 不是 JWT 格式'
        }
    } else {
        Report 'FAIL' 'auth.json 无 access_token。修复: codex login'
    }
} else {
    Report 'FAIL' ('未找到 ' + $authPath + '。修复: codex login')
}

Write-Host ""
Write-Host "4) DSH 凭证一致性" -ForegroundColor Cyan
$credPath = Join-Path $env:USERPROFILE '.dsh\.credentials.yaml'
if (Test-Path $credPath) {
    $cred = Get-Content $credPath -Raw
    $m = [regex]::Match($cred, '(?m)^CODEX_ACCESS_TOKEN:\s*(\S+)')
    if ($m.Success) {
        $credToken = $m.Groups[1].Value
        if (Test-Path $authPath) {
            $auth = Get-Content $authPath -Raw | ConvertFrom-Json
            $tok = [string]$auth.tokens.access_token
            if ($credToken -eq $tok) {
                Report 'OK' ('CODEX_ACCESS_TOKEN 与 auth.json 一致 (长度 ' + $credToken.Length + ')')
            } else {
                Report 'FAIL' '凭证与 auth.json 不一致。修复: powershell -ExecutionPolicy Bypass -File scripts\sync-codex-token.ps1'
            }
        }
    } else {
        Report 'FAIL' '凭证文件缺少 CODEX_ACCESS_TOKEN。修复: sync-codex-token.ps1'
    }
} else {
    Report 'FAIL' ('未找到 ' + $credPath + '。修复: sync-codex-token.ps1')
}

Write-Host ""
Write-Host ('5) 代理可达性 (127.0.0.1:' + $ProxyPort + ')') -ForegroundColor Cyan
$t = Test-NetConnection -ComputerName 127.0.0.1 -Port $ProxyPort -WarningAction SilentlyContinue
if ($t.TcpTestSucceeded) {
    Report 'OK' '代理端口可达 (Clash Verge 运行中)'
} else {
    Report 'FAIL' ('代理端口不可达。修复: 启动 Clash Verge (或换端口 -ProxyPort ' + $ProxyPort + ')')
}

Write-Host ""
Write-Host "6) 当前进程代理环境" -ForegroundColor Cyan
$hasProxy = [bool]$env:HTTPS_PROXY
$hasNode = [bool]$env:NODE_USE_ENV_PROXY
if ($hasProxy -and $hasNode) {
    Report 'OK' ('HTTPS_PROXY=' + $env:HTTPS_PROXY + ', NODE_USE_ENV_PROXY=' + $env:NODE_USE_ENV_PROXY)
} else {
    Report 'WARN' ('本进程(及未重启的 DSH 宿主)无代理环境变量。注册表已持久化(' + [Environment]::GetEnvironmentVariable('HTTPS_PROXY','User') + ')。修复: 从新开终端运行 dsh web 并重启')
}

Write-Host ""
Write-Host "7) subagent-codex 组件" -ForegroundColor Cyan
$pkg = Join-Path $env:USERPROFILE '.bun\install\global\node_modules\@deepseek-ai\dsh-subagent-codex\package.json'
if (Test-Path $pkg) {
    $v = (Get-Content $pkg -Raw | ConvertFrom-Json).version
    Report 'OK' ('全局包已安装: @deepseek-ai/dsh-subagent-codex@' + $v)
} else {
    Report 'WARN' '全局包缺失。修复: bun add -g @deepseek-ai/dsh-subagent-codex (版本与 dsh --version 的 rc 匹配)'
}
$patch = Join-Path $env:USERPROFILE '.dsh\profiles\web\cordis.patch.yml'
if (Test-Path $patch) {
    $pc = Get-Content $patch -Raw
    if ($pc -match 'subagent-codex') {
        Report 'OK' ('宿主补丁已含 subagent-codex (' + $patch + ')')
    } else {
        Report 'WARN' '宿主补丁不含 subagent-codex。修复: 按 README 第 4 节追加'
    }
} else {
    Report 'WARN' ('未找到宿主补丁 ' + $patch + ' (非 web profile 部署可忽略)')
}

Write-Host ""
Write-Host "==== 结论 ====" -ForegroundColor Cyan
Write-Host ('  OK: ' + $ok + '   WARN: ' + $warn + '   FAIL: ' + $fail)
if ($fail -eq 0) {
    Write-Host "  链路基本健康。若 DSH 内仍无法使用 GPT,最可能原因是宿主未重启:" -ForegroundColor Green
    Write-Host "    1) 关闭当前 dsh web 进程" -ForegroundColor Green
    Write-Host "    2) 新开一个终端 (确保 echo $env:HTTPS_PROXY 有值)" -ForegroundColor Green
    Write-Host "    3) 运行 dsh web, 重新打开 http://127.0.0.1:3080" -ForegroundColor Green
} else {
    Write-Host "  存在 FAIL 项, 按上方修复建议逐项处理。" -ForegroundColor Red
}
