# sync-codex-token.ps1
# 将 codex 登录凭证(~/.codex/auth.json)中的最新 access_token 同步到 DSH 凭证
# (~/.dsh/.credentials.yaml 的 CODEX_ACCESS_TOKEN),供 DSH 的 openai-codex
# provider(主对话模型走 GPT)使用。
#
# 用法:  powershell -ExecutionPolicy Bypass -File C:\Users\86158\.dsh\sync-codex-token.ps1
# 何时用: codex 登录刷新后,或发现 GPT 请求报 401/过期时。

$ErrorActionPreference = 'Stop'

$authPath = Join-Path $env:USERPROFILE '.codex\auth.json'
$credPath = Join-Path $env:USERPROFILE '.dsh\.credentials.yaml'

if (-not (Test-Path $authPath)) {
    Write-Host "未找到 codex 登录凭证: $authPath。请先运行 codex login。"
    exit 1
}

$auth = Get-Content $authPath -Raw | ConvertFrom-Json
$token = $auth.tokens.access_token
if (-not $token) {
    Write-Host "auth.json 中没有 access_token。请重新运行 codex login。"
    exit 1
}

# 读取现有凭证,替换或追加 CODEX_ACCESS_TOKEN(保留其他键)
$lines = [System.IO.File]::ReadAllLines($credPath)
$found = $false
$out = [System.Collections.Generic.List[string]]::new()
foreach ($line in $lines) {
    if ($line -match '^CODEX_ACCESS_TOKEN:') {
        $out.Add("CODEX_ACCESS_TOKEN: $token")
        $found = $true
    } else {
        $out.Add($line)
    }
}
if (-not $found) {
    $out.Add("CODEX_ACCESS_TOKEN: $token")
}

$content = ($out -join "`r`n") + "`r`n"
[System.IO.File]::WriteAllText($credPath, $content, [System.Text.UTF8Encoding]::new($false))

Write-Host "已同步 CODEX_ACCESS_TOKEN ($($token.Length) 字符) -> $credPath"
