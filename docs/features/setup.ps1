# ═══════════════════════════════════════════════════════════════
# 🚀 DAWN — Instalador Inteligente v3.1
# Repo: https://github.com/landyboostwhat-rgb/Dawn
# ═══════════════════════════════════════════════════════════════
#
# USO:
#   .\setup.ps1              → Modo normal (interactivo)
#   .\setup.ps1 -Silent      → Modo silencioso (sin preguntas)
#   .\setup.ps1 -Verbose     → Logs detallados
#   .\setup.ps1 -NoUpdate    → No auto-actualizar el script
#   .\setup.ps1 -NoVoice     → Sin voz
#   .\setup.ps1 -NoToast     → Sin notificaciones
#   .\setup.ps1 -Diagnose    → Solo diagnóstico del sistema
#
# ═══════════════════════════════════════════════════════════════

[CmdletBinding()]
param(
    [switch]$Silent,
    [switch]$NoUpdate,
    [switch]$NoVoice,
    [switch]$NoToast,
    [switch]$Diagnose,
    [string]$GitHubToken = ""
)

$ErrorActionPreference = "Continue"
$Host.UI.RawUI.WindowTitle = "DAWN Installer v3.1"

# ═══════════════════════════════════════════════════════════════
# 📋 CONFIGURACIÓN
# ═══════════════════════════════════════════════════════════════
$script:Config = @{
    ScriptVersion       = "3.1.0"
    RepoOwner           = "landyboostwhat-rgb"
    RepoName            = "Dawn"
    ProjectPath         = "$HOME\Documents\Dawn"
    LogFile             = "$HOME\Documents\dawn-installer.log"
    ScriptRawUrl        = "https://raw.githubusercontent.com/landyboostwhat-rgb/dawn-installer/main/setup.ps1"

    MinNodeVersion      = [version]"18.0.0"
    MinRustVersion      = [version]"1.70.0"
    MinDiskSpaceGB      = 10
    MinRamGB            = 4
}

$script:StepResults = @{}
$script:TotalSteps  = 7
$script:CurrentStep = 0

# ═══════════════════════════════════════════════════════════════
# 📝 LOGGING
# ═══════════════════════════════════════════════════════════════
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] [$Level] $Message"
    Add-Content -Path $script:Config.LogFile -Value $line -ErrorAction SilentlyContinue
    if ($VerbosePreference -eq "Continue") {
        Write-Host "  [LOG] $Message" -ForegroundColor DarkGray
    }
}

# ═══════════════════════════════════════════════════════════════
# 🔊 VOZ EN ESPAÑOL
# ═══════════════════════════════════════════════════════════════
$script:Voice = $null

function Init-Voice {
    if ($NoVoice) { return }
    try {
        Add-Type -AssemblyName System.Speech
        $script:Voice = New-Object System.Speech.Synthesis.SpeechSynthesizer

        $spanishVoice = $script:Voice.GetInstalledVoices() |
            Where-Object { $_.VoiceInfo.Culture.Name -like "es-*" } |
            Select-Object -First 1

        if ($spanishVoice) {
            $script:Voice.SelectVoice($spanishVoice.VoiceInfo.Name)
            Write-Log "Voz en español activada: $($spanishVoice.VoiceInfo.Name)"
        } else {
            Write-Log "No hay voz en español, usando por defecto" "WARN"
        }

        $script:Voice.Rate = 0
        $script:Voice.Volume = 80
    } catch {
        Write-Log "No se pudo inicializar voz: $_" "WARN"
        $script:Voice = $null
    }
}

function Speak {
    param([string]$Text)
    if ($NoVoice -or -not $script:Voice) { return }
    try {
        $script:Voice.SpeakAsyncCancelAll() | Out-Null
        $script:Voice.SpeakAsync($Text) | Out-Null
    } catch {
        Write-Log "Error al hablar: $_" "WARN"
    }
}

function Play-Sound {
    param([string]$Type = "success")
    try {
        switch ($Type) {
            "success" { [console]::beep(800, 200); [console]::beep(1200, 300) }
            "error"   { [console]::beep(400, 400); [console]::beep(300, 400) }
            "warn"    { [console]::beep(600, 150); [console]::beep(600, 150) }
            "start"   { [console]::beep(1000, 100) }
        }
    } catch { }
}

# ═══════════════════════════════════════════════════════════════
# 🔔 TOAST NOTIFICATIONS
# ═══════════════════════════════════════════════════════════════
function Show-Toast {
    param([string]$Title, [string]$Message, [string]$Icon = "ℹ️")
    if ($NoToast) { return }
    try {
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
        [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] > $null

        $template = @"
<toast>
    <visual>
        <binding template="ToastGeneric">
            <text>$Icon $Title</text>
            <text>$Message</text>
        </binding>
    </visual>
</toast>
"@
        $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
        $xml.LoadXml($template)
        $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("DAWN Installer").Show($toast)
    } catch {
        Write-Log "Toast fallback: $Title" "WARN"
    }
}

# ═══════════════════════════════════════════════════════════════
# 🎨 UTILIDADES VISUALES
# ═══════════════════════════════════════════════════════════════
function Write-Progress-Bar {
    param([int]$Current, [int]$Total, [string]$Activity, [string]$Status = "")
    $percent = [math]::Round(($Current / $Total) * 100)
    $barLength = 40
    $filled = [math]::Round(($Current / $Total) * $barLength)
    $bar = "█" * $filled + "░" * ($barLength - $filled)

    Write-Host ""
    Write-Host "  [" -NoNewline -ForegroundColor DarkGray
    Write-Host $bar -NoNewline -ForegroundColor Magenta
    Write-Host "] " -NoNewline -ForegroundColor DarkGray
    Write-Host "$percent%" -ForegroundColor Cyan
    Write-Host "  📍 Paso $Current de $Total  •  $Activity" -ForegroundColor White
    if ($Status) { Write-Host "     $Status" -ForegroundColor Gray }
    Write-Host ""
}

function Show-Header {
    Write-Host ""
    Write-Host " ██████╗  █████╗ ██╗    ██╗███╗   ██╗" -ForegroundColor Magenta
    Write-Host " ██╔══██╗██╔══██╗██║    ██║████╗  ██║  " -NoNewline -ForegroundColor Magenta
    Write-Host "Digital Audio Workstation" -ForegroundColor Gray
    Write-Host " ██║  ██║███████║██║ █╗ ██║██╔██╗ ██║  " -NoNewline -ForegroundColor Magenta
    Write-Host "Instalador v$($script:Config.ScriptVersion)" -ForegroundColor Gray
    Write-Host " ██║  ██║██╔══██║██║███╗██║██║╚██╗██║" -ForegroundColor Magenta
    Write-Host " ██████╔╝██║  ██║╚███╔███╔╝██║ ╚████║" -ForegroundColor Magenta
    Write-Host " ╚═════╝ ╚═╝  ╚═╝ ╚══╝╚══╝ ╚═╝  ╚═══╝" -ForegroundColor Magenta
    Write-Host ""
}

function Write-Step {
    param([string]$Number, [string]$Title, [string]$Description = "")
    $script:CurrentStep = [int]($Number.Split('/')[0])
    Clear-Host
    Show-Header
    Write-Progress-Bar -Current $script:CurrentStep -Total $script:TotalSteps -Activity $Title -Status $Description
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  🔧 $Title" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    Write-Log "STEP $Number - $Title"
}

function Write-Task    { param([string]$m) Write-Host "  ⏳ " -NoNewline -ForegroundColor Yellow; Write-Host $m -ForegroundColor White; Write-Log $m "TASK" }
function Write-Success { param([string]$m) Write-Host "  ✅ " -NoNewline -ForegroundColor Green;  Write-Host $m -ForegroundColor White; Write-Log $m "SUCCESS" }
function Write-Fail    { param([string]$m) Write-Host "  ❌ " -NoNewline -ForegroundColor Red;    Write-Host $m -ForegroundColor White; Write-Log $m "FAIL"; Play-Sound "error" }
function Write-Info    { param([string]$m) Write-Host "  💡 " -NoNewline -ForegroundColor Cyan;   Write-Host $m -ForegroundColor White; Write-Log $m "INFO" }
function Write-Skip    { param([string]$m) Write-Host "  ⏭️  " -NoNewline -ForegroundColor DarkYellow; Write-Host $m -ForegroundColor Gray; Write-Log $m "SKIP" }
function Write-Warn    { param([string]$m) Write-Host "  ⚠️  " -NoNewline -ForegroundColor Yellow; Write-Host $m -ForegroundColor White; Write-Log $m "WARN"; Play-Sound "warn" }

function Test-Command  { param([string]$c) return [bool](Get-Command $c -ErrorAction SilentlyContinue) }
function Refresh-Path  { $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User") }

function Pause-User {
    param([string]$Message = "Presiona ENTER para continuar...")
    if ($Silent) { return }
    Write-Host ""; Write-Host "  ⏸️  $Message" -ForegroundColor Yellow; Read-Host
}

function Ask-User {
    param([string]$Question, [string]$Default = "S")
    if ($Silent) { return $Default }
    $answer = Read-Host "  $Question"
    if ([string]::IsNullOrWhiteSpace($answer)) { return $Default }
    return $answer
}

function Register-Result {
    param([string]$Step, [string]$Status, [string]$Detail = "")
    $script:StepResults[$Step] = @{ Status = $Status; Detail = $Detail }
}

# ═══════════════════════════════════════════════════════════════
# 🌐 AUTO-UPDATE
# ═══════════════════════════════════════════════════════════════
function Check-ScriptUpdate {
    if ($NoUpdate) { return }
    Write-Task "Verificando si hay nueva versión del instalador..."
    try {
        $latest = Invoke-WebRequest -Uri $script:Config.ScriptRawUrl -UseBasicParsing -TimeoutSec 10
        $match = [regex]::Match($latest.Content, 'ScriptVersion\s*=\s*"([\d.]+)"')
        if ($match.Success) {
            $latestVer = [version]$match.Groups[1].Value
            $currentVer = [version]$script:Config.ScriptVersion
            if ($latestVer -gt $currentVer) {
                Write-Warn "Nueva versión: $latestVer (tienes $currentVer)"
                $update = Ask-User "¿Actualizar ahora? (S/N)" "S"
                if ($update -eq "S" -or $update -eq "s") {
                    Speak "Actualizando el instalador"
                    $selfPath = $MyInvocation.ScriptName
                    $latest.Content | Set-Content -Path $selfPath -Encoding UTF8
                    Write-Success "Actualizado. Reiniciando..."
                    Start-Sleep -Seconds 2
                    & powershell.exe -File $selfPath
                    exit 0
                }
            } else {
                Write-Success "Ya tienes la última versión ($currentVer)"
            }
        }
    } catch {
        Write-Warn "No se pudo verificar actualización: $($_.Exception.Message)"
    }
}

# ═══════════════════════════════════════════════════════════════
# 🔍 VERSIONES MÍNIMAS
# ═══════════════════════════════════════════════════════════════
function Get-CommandVersion {
    param([string]$Cmd, [string]$Arg = "--version")
    try {
        $raw = & $Cmd $Arg 2>&1 | Select-Object -First 1
        $match = [regex]::Match($raw, '(\d+\.\d+\.\d+)')
        if ($match.Success) { return [version]$match.Groups[1].Value }
    } catch { }
    return $null
}

function Test-VersionOk {
    param([string]$Name, [version]$Current, [version]$Minimum)
    if (-not $Current) {
        Write-Fail "$Name : NO INSTALADO"
        return $false
    }
    if ($Current -lt $Minimum) {
        Write-Warn "$Name : $Current (mínimo $Minimum) — OBSOLETO"
        return $false
    }
    Write-Success "$Name : $Current"
    return $true
}

# ═══════════════════════════════════════════════════════════════
# 💾 CHECKS DE SISTEMA
# ═══════════════════════════════════════════════════════════════
function Test-DiskSpace {
    param([string]$Path = $HOME)
    try {
        $drive = (Get-Item $Path).PSDrive
        $freeGB = [math]::Round($drive.Free / 1GB, 2)
        Write-Task "Espacio libre en disco $($drive.Name):"

        if ($freeGB -lt $script:Config.MinDiskSpaceGB) {
            Write-Fail "$freeGB GB (mínimo $($script:Config.MinDiskSpaceGB) GB)"
            Speak "Advertencia. No tienes suficiente espacio en disco."
            return $false
        }
        Write-Success "$freeGB GB disponibles ✨"
        return $true
    } catch {
        Write-Warn "No se pudo verificar el disco"
        return $true
    }
}

function Test-Antivirus {
    Write-Task "Verificando Windows Defender..."
    try {
        $defender = Get-MpPreference -ErrorAction Stop
        if ($defender.DisableRealtimeMonitoring) {
            Write-Success "Defender: Protección en tiempo real DESACTIVADA"
            return $true
        }
        Write-Warn "Windows Defender ACTIVO"
        Write-Info "Puede ralentizar la compilación de Rust hasta 3x"
        $exclude = Ask-User "¿Añadir exclusión para acelerar? (S/N)" "S"
        if ($exclude -eq "S" -or $exclude -eq "s") {
            try {
                Add-MpPreference -ExclusionPath $script:Config.ProjectPath -ErrorAction SilentlyContinue
                Add-MpPreference -ExclusionPath "$HOME\.cargo" -ErrorAction SilentlyContinue
                Add-MpPreference -ExclusionPath "$HOME\.rustup" -ErrorAction SilentlyContinue
                Add-MpPreference -ExclusionProcess "cargo.exe" -ErrorAction SilentlyContinue
                Add-MpPreference -ExclusionProcess "rustc.exe" -ErrorAction SilentlyContinue
                Add-MpPreference -ExclusionProcess "node.exe" -ErrorAction SilentlyContinue
                Write-Success "Exclusiones añadidas"
            } catch { Write-Warn "No se pudieron añadir exclusiones" }
        }
        return $true
    } catch { return $true }
}

function Test-Internet {
    Write-Task "Verificando conexión a internet..."
    $hosts = @("github.com", "chocolatey.org", "registry.npmjs.org")
    $allOk = $true
    foreach ($h in $hosts) {
        if (Test-Connection -ComputerName $h -Count 1 -Quiet -ErrorAction SilentlyContinue) {
            Write-Success "$h : Conectado"
        } else {
            Write-Fail "$h : Sin conexión"
            $allOk = $false
        }
    }
    return $allOk
}

# ═══════════════════════════════════════════════════════════════
# 🔐 GITHUB API
# ═══════════════════════════════════════════════════════════════
function Test-GitHubToken {
    param([string]$Token)
    if (-not $Token) {
        $Token = Read-Host "  🔑 Pega tu Personal Access Token (ghp_...)"
    }
    Write-Task "Validando token con GitHub..."
    try {
        $headers = @{ Authorization = "token $Token"; Accept = "application/vnd.github.v3+json" }
        $user = Invoke-RestMethod -Uri "https://api.github.com/user" -Headers $headers -TimeoutSec 10
        Write-Success "Token válido — Usuario: $($user.login)"
        Speak "Hola $($user.login)"

        # Verificar invitación pendiente
        try {
            $invitations = Invoke-RestMethod -Uri "https://api.github.com/user/repository_invitations" -Headers $headers -TimeoutSec 10
            $pending = $invitations | Where-Object { $_.repository.full_name -eq "$($script:Config.RepoOwner)/$($script:Config.RepoName)" }
            if ($pending) {
                Write-Warn "Invitación PENDIENTE al repo"
                $accept = Ask-User "¿Aceptar automáticamente? (S/N)" "S"
                if ($accept -eq "S" -or $accept -eq "s") {
                    Invoke-RestMethod -Uri "https://api.github.com/user/repository_invitations/$($pending.id)" -Method PATCH -Headers $headers | Out-Null
                    Write-Success "Invitación aceptada ✨"
                }
            }
            $repo = Invoke-RestMethod -Uri "https://api.github.com/repos/$($script:Config.RepoOwner)/$($script:Config.RepoName)" -Headers $headers -TimeoutSec 10
            Write-Success "Acceso al repo confirmado: $($repo.full_name)"
            return @{ Success = $true; Token = $Token; User = $user }
        } catch {
            Write-Warn "No tienes acceso al repo. Verifica la invitación."
            return @{ Success = $false; Token = $Token }
        }
    } catch {
        Write-Fail "Token inválido: $($_.Exception.Message)"
        return @{ Success = $false; Token = $null }
    }
}

# ═══════════════════════════════════════════════════════════════
# 🔧 AUTO-FIX
# ═══════════════════════════════════════════════════════════════
function Fix-CommonIssues {
    Write-Task "Verificando problemas comunes..."
    try { [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; Write-Success "TLS 1.2 habilitado" } catch { }

    $proxy = [System.Net.WebRequest]::GetSystemWebProxy()
    if ($proxy.GetProxy("https://github.com").ToString() -ne "https://github.com/") {
        Write-Warn "Proxy detectado"
        $proxyUrl = $proxy.GetProxy("https://github.com").ToString()
        [System.Net.WebRequest]::DefaultWebProxy.Credentials = [System.Net.CredentialCache]::DefaultCredentials
        git config --global http.proxy $proxyUrl 2>&1 | Out-Null
        Write-Success "Proxy configurado"
    }

    try {
        $lpVal = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -ErrorAction Stop
        if ($lpVal.LongPathsEnabled -eq 0) {
            Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -ErrorAction SilentlyContinue
            Write-Success "Long paths habilitados"
        }
    } catch { }

    git config --global core.autocrlf true 2>&1 | Out-Null
    git config --global core.longpaths true 2>&1 | Out-Null
    Write-Success "Problemas comunes verificados"
}

# ═══════════════════════════════════════════════════════════════
# ⚡ INSTALACIÓN PARALELA
# ═══════════════════════════════════════════════════════════════
function Install-Parallel {
    param([array]$Packages)
    if ($Packages.Count -eq 0) { return }
    Write-Task "Instalando en paralelo: $($Packages -join ', ')"
    Write-Info "Reduce el tiempo hasta 3x ⚡"
    Write-Host ""

    $jobs = @()
    foreach ($pkg in $Packages) {
        $jobs += Start-Job -Name $pkg -ScriptBlock {
            param($p)
            $result = choco install -y $p --no-progress 2>&1
            return @{ Package = $p; Output = $result; ExitCode = $LASTEXITCODE }
        } -ArgumentList $pkg
    }

    $spinner = @('⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏')
    $i = 0
    while ($jobs | Where-Object { $_.State -eq 'Running' }) {
        $running = ($jobs | Where-Object { $_.State -eq 'Running' }).Count
        $done = $jobs.Count - $running
        Write-Host "`r  $($spinner[$i % $spinner.Length]) Instalando... [$done/$($jobs.Count)]   " -NoNewline -ForegroundColor Cyan
        Start-Sleep -Milliseconds 200
        $i++
    }
    Write-Host "`r" -NoNewline

    $results = $jobs | ForEach-Object {
        $r = Receive-Job -Job $_
        Remove-Job -Job $_
        return $r
    }

    foreach ($r in $results) {
        if ($r.ExitCode -eq 0 -or $r.ExitCode -eq 3010) {
            Write-Success "$($r.Package) instalado"
        } else {
            Write-Fail "$($r.Package) falló"
        }
    }
    Refresh-Path
}

# ═══════════════════════════════════════════════════════════════
# 🔍 DETECCIÓN INTELIGENTE DEL PROYECTO DAWN
# ═══════════════════════════════════════════════════════════════
function Test-IsDawnProject {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return $false }
    $fingerprints = @(
        "package.json",
        "src-tauri\tauri.conf.json",
        "src\App.tsx",
        "src-tauri\Cargo.toml"
    )
    $matches = 0
    foreach ($fp in $fingerprints) {
        if (Test-Path (Join-Path $Path $fp)) { $matches++ }
    }
    if ($matches -lt 3) { return $false }
    try {
        $pkg = Get-Content (Join-Path $Path "package.json") -Raw | ConvertFrom-Json
        if ($pkg.name -match "dawn|web-daw") { return $true }
    } catch { }
    return ($matches -ge 3)
}

function Find-ExistingDawn {
    Write-Task "Buscando instalaciones previas de DAWN..."
    $searchPaths = @(
        "$HOME\Documents\Dawn",
        "$HOME\Documents\DAWN",
        "$HOME\Documents\dawn",
        "$HOME\Desktop\Dawn",
        "$HOME\Desktop\DAWN",
        "$HOME\Downloads\Dawn",
        "$HOME\Downloads\DAWN",
        "$HOME\Downloads\Landy_Proyectos\Apps\DAWN",
        "$HOME\Projects\Dawn",
        "$HOME\Projects\DAWN",
        "$HOME\source\repos\Dawn",
        "$HOME\dev\Dawn",
        "$HOME\code\Dawn",
        "C:\Dawn",
        "C:\DAWN",
        "C:\Projects\Dawn",
        "D:\Dawn",
        "D:\DAWN",
        "D:\Projects\Dawn"
    )
    $found = @()
    foreach ($path in $searchPaths) {
        if (Test-IsDawnProject $path) {
            $found += $path
            Write-Success "Encontrado en: $path"
        }
    }
    if ($found.Count -eq 0) {
        Write-Skip "No se encontró ninguna instalación previa"
    }
    return $found
}

function Ask-InstallPath {
    Clear-Host
    Show-Header
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Yellow
    Write-Host "  📂 ELEGIR DÓNDE INSTALAR DAWN" -ForegroundColor Yellow
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Yellow
    Write-Host ""
    Speak "Elige dónde quieres instalar DAWN"

    Write-Host "  💡 CÓMO OBTENER UNA RUTA:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Opción 1 — Con el Explorador de Windows:" -ForegroundColor White
    Write-Host "    1. Abre el Explorador (Windows + E)" -ForegroundColor Gray
    Write-Host "    2. Ve a la carpeta donde quieres instalar" -ForegroundColor Gray
    Write-Host "    3. Clic en la barra de direcciones (arriba)" -ForegroundColor Gray
    Write-Host "    4. Copia la ruta con Ctrl + C" -ForegroundColor Gray
    Write-Host "    5. Vuelve aquí y clic derecho para pegar" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Opción 2 — Presiona ENTER para usar por defecto:" -ForegroundColor White
    Write-Host "    $HOME\Documents\Dawn" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Opción 3 — Escribe una ruta directa, ejemplos:" -ForegroundColor White
    Write-Host "    C:\Dawn" -ForegroundColor DarkGray
    Write-Host "    D:\Proyectos\Dawn" -ForegroundColor DarkGray
    Write-Host "    $HOME\Desktop\Dawn" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  ⚠️  IMPORTANTE:" -ForegroundColor Yellow
    Write-Host "     • NO uses caracteres especiales raros" -ForegroundColor Gray
    Write-Host "     • La carpeta 'Dawn' se crea automáticamente si no existe" -ForegroundColor Gray
    Write-Host "     • Necesitas al menos 10 GB libres" -ForegroundColor Gray
    Write-Host ""

    while ($true) {
        Write-Host "  📍 Pega o escribe la ruta (ENTER = por defecto):" -ForegroundColor Cyan
        $userInput = Read-Host "     "

        if ([string]::IsNullOrWhiteSpace($userInput)) {
            $chosen = "$HOME\Documents\Dawn"
            Write-Success "Usando ruta por defecto: $chosen"
            return $chosen
        }

        $userInput = $userInput.Trim().Trim('"').Trim("'").TrimEnd('\')

        $folderName = Split-Path $userInput -Leaf
        if ($folderName -notmatch "^(dawn)$") {
            $userInput = Join-Path $userInput "Dawn"
            Write-Info "Ajustando ruta a: $userInput"
        }

        $parent = Split-Path $userInput -Parent
        if (-not (Test-Path $parent)) {
            Write-Fail "La carpeta padre '$parent' no existe"
            Write-Info "Verifica la ruta e intenta de nuevo"
            Write-Host ""
            continue
        }

        try {
            $driveLetter = (Split-Path $userInput -Qualifier).TrimEnd(':')
            $drive = Get-PSDrive -Name $driveLetter -ErrorAction Stop
            $freeGB = [math]::Round($drive.Free / 1GB, 2)
            if ($freeGB -lt $script:Config.MinDiskSpaceGB) {
                Write-Warn "Solo $freeGB GB libres en $driveLetter: (recomendado 10 GB+)"
                $c = Ask-User "¿Continuar? (S/N)" "N"
                if ($c -ne "S" -and $c -ne "s") { continue }
            } else {
                Write-Success "Espacio disponible en $driveLetter: $freeGB GB"
            }
        } catch { }

        if (Test-Path $userInput) {
            if (-not (Test-IsDawnProject $userInput)) {
                Write-Warn "La carpeta '$userInput' YA existe pero NO es DAWN"
                $confirm = Ask-User "¿Usar y sobreescribir? (S/N)" "N"
                if ($confirm -ne "S" -and $confirm -ne "s") { continue }
            }
        }

        Write-Success "Ruta elegida: $userInput"
        Speak "Ruta seleccionada"
        return $userInput
    }
}

function Resolve-DawnLocation {
    Clear-Host
    Show-Header
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  🔍 DETECTANDO PROYECTO DAWN" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    Speak "Buscando instalaciones previas de DAWN"

    $existing = Find-ExistingDawn

    if ($existing.Count -eq 0) {
        Write-Host ""
        Write-Info "No tienes DAWN instalado. Vamos a instalarlo."
        Speak "No encontré DAWN. Vamos a instalarlo."
        Pause-User "Presiona ENTER para elegir dónde instalar"
        return @{ Path = Ask-InstallPath; Action = "clone"; IsNew = $true }
    }

    if ($existing.Count -eq 1) {
        Write-Host ""
        Write-Success "🎯 Se detectó DAWN en:"
        Write-Host "     $($existing[0])" -ForegroundColor Cyan
        Write-Host ""
        Speak "Se detectó una instalación existente de DAWN"
        Write-Host "  Opciones:" -ForegroundColor White
        Write-Host "    [1] Usar esta instalación (recomendado)" -ForegroundColor Green
        Write-Host "    [2] Actualizar con git pull" -ForegroundColor White
        Write-Host "    [3] Instalar en otra ubicación (nueva copia)" -ForegroundColor White
        Write-Host "    [4] Salir" -ForegroundColor Gray
        Write-Host ""
        $choice = Ask-User "¿Qué prefieres? (1-4)" "1"
        switch ($choice) {
            "1" { return @{ Path = $existing[0]; Action = "skip";   IsNew = $false } }
            "2" { return @{ Path = $existing[0]; Action = "update"; IsNew = $false } }
            "3" { return @{ Path = Ask-InstallPath; Action = "clone"; IsNew = $true } }
            default { Speak "Hasta pronto"; exit 0 }
        }
    }

    Write-Host ""
    Write-Warn "Se encontraron $($existing.Count) instalaciones:"
    Write-Host ""
    for ($i = 0; $i -lt $existing.Count; $i++) {
        Write-Host "    [$($i+1)] $($existing[$i])" -ForegroundColor Cyan
    }
    Write-Host "    [N] Instalar en OTRA ubicación" -ForegroundColor White
    Write-Host "    [X] Salir" -ForegroundColor Gray
    Write-Host ""
    while ($true) {
        $choice = Ask-User "¿Cuál usar? (1-$($existing.Count) / N / X)" "1"
        if ($choice -eq "X" -or $choice -eq "x") { Speak "Hasta pronto"; exit 0 }
        if ($choice -eq "N" -or $choice -eq "n") {
            return @{ Path = Ask-InstallPath; Action = "clone"; IsNew = $true }
        }
        $idx = [int]$choice - 1
        if ($idx -ge 0 -and $idx -lt $existing.Count) {
            $picked = $existing[$idx]
            Write-Success "Usando: $picked"
            $update = Ask-User "¿Actualizar con git pull? (S/N)" "S"
            $action = if ($update -eq "S" -or $update -eq "s") { "update" } else { "skip" }
            return @{ Path = $picked; Action = $action; IsNew = $false }
        }
        Write-Fail "Opción inválida"
    }
}

# ═══════════════════════════════════════════════════════════════
# 🚀 ABRIR PROYECTO
# ═══════════════════════════════════════════════════════════════
function Open-Project {
    param([string]$Path, [bool]$StartDawn = $false)
    Set-Location $Path
    if (Test-Command "code") {
        Start-Process "code" -ArgumentList "`"$Path`""
        Start-Sleep -Seconds 2
        Write-Success "Proyecto abierto en VS Code"
    } else {
        Start-Process "explorer.exe" -ArgumentList "`"$Path`""
        Write-Info "VS Code no instalado. https://code.visualstudio.com/"
    }
    if ($StartDawn) {
        $command = "cd `"$Path`"; Write-Host '🎹 DAWN — Arrancando (primera vez 10-15 min)' -ForegroundColor Magenta; yarn tauri dev"
        Start-Process "powershell.exe" -ArgumentList "-NoExit", "-Command", $command
        Write-Success "DAWN arrancando en nueva ventana"
        Show-Toast -Title "DAWN se está iniciando" -Message "Compilación tarda 10-15 min primera vez" -Icon "🎹"
    }
}

# ═══════════════════════════════════════════════════════════════
# 🔍 MODO DIAGNÓSTICO
# ═══════════════════════════════════════════════════════════════
function Run-Diagnose {
    Clear-Host
    Show-Header
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Yellow
    Write-Host "  🔬 MODO DIAGNÓSTICO" -ForegroundColor Yellow
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Yellow
    Write-Host ""

    Write-Host "  🖥️  SISTEMA" -ForegroundColor Cyan
    $os = Get-CimInstance Win32_OperatingSystem
    Write-Info "OS: $($os.Caption) $($os.Version)"
    $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
    Write-Info "CPU: $($cpu.Name) — $($cpu.NumberOfCores) cores"
    $ram = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 2)
    Write-Info "RAM: $ram GB"

    Write-Host ""; Write-Host "  💾  DISCO" -ForegroundColor Cyan
    Test-DiskSpace | Out-Null

    Write-Host ""; Write-Host "  🌐  RED" -ForegroundColor Cyan
    Test-Internet | Out-Null

    Write-Host ""; Write-Host "  🛡️  SEGURIDAD" -ForegroundColor Cyan
    Test-Antivirus | Out-Null

    Write-Host ""; Write-Host "  🔧  HERRAMIENTAS" -ForegroundColor Cyan
    $nodeVer = Get-CommandVersion "node"
    $rustVer = Get-CommandVersion "rustc"
    Test-VersionOk "Node.js" $nodeVer $script:Config.MinNodeVersion | Out-Null
    Test-VersionOk "Rust"    $rustVer $script:Config.MinRustVersion | Out-Null
    foreach ($c in @("git","yarn","cargo","choco","code")) {
        if (Test-Command $c) { Write-Success "$c : instalado" } else { Write-Fail "$c : falta" }
    }

    Write-Host ""; Write-Host "  📂  PROYECTO DAWN" -ForegroundColor Cyan
    $existing = Find-ExistingDawn
    if ($existing.Count -gt 0) {
        foreach ($p in $existing) { Write-Success "En: $p" }
    }

    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "  ✅ DIAGNÓSTICO COMPLETADO" -ForegroundColor Green
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host ""
    Write-Info "Log: $($script:Config.LogFile)"
    Read-Host "Presiona ENTER para salir"
    exit 0
}

# ═══════════════════════════════════════════════════════════════
# 🚀 MAIN
# ═══════════════════════════════════════════════════════════════

# Init
"" | Set-Content -Path $script:Config.LogFile -ErrorAction SilentlyContinue
Write-Log "═══ INSTALADOR INICIADO ═══"
Write-Log "Versión: $($script:Config.ScriptVersion) | Silent: $Silent | NoVoice: $NoVoice"

Init-Voice
Play-Sound "start"

# Modo diagnóstico
if ($Diagnose) { Run-Diagnose }

# Admin check
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Clear-Host; Show-Header
    Write-Fail "Este script necesita permisos de Administrador"
    Speak "Necesito permisos de administrador. Cierra esta ventana y ábrela como administrador."
    Write-Info "Clic derecho en PowerShell → 'Ejecutar como administrador'"
    Read-Host "Presiona ENTER para salir"
    exit 1
}

# Auto-update
Check-ScriptUpdate

# Bienvenida
Clear-Host
Show-Header
Speak "Bienvenido al instalador de DAWN"
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host "  🎹 BIENVENIDO AL INSTALADOR DE DAWN v$($script:Config.ScriptVersion)" -ForegroundColor Magenta
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host ""
Write-Host "  Flags disponibles:" -ForegroundColor Gray
Write-Host "    -Silent    Modo automático" -ForegroundColor DarkGray
Write-Host "    -Verbose   Logs detallados" -ForegroundColor DarkGray
Write-Host "    -NoVoice   Sin voz" -ForegroundColor DarkGray
Write-Host "    -NoToast   Sin notificaciones" -ForegroundColor DarkGray
Write-Host "    -Diagnose  Solo diagnóstico" -ForegroundColor DarkGray
Write-Host ""

Pause-User "Presiona ENTER para iniciar el escaneo"

# ═══════════════════════════════════════════════════════════════
# 🔎 ESCANEO PRE-INSTALACIÓN
# ═══════════════════════════════════════════════════════════════
Clear-Host; Show-Header
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  🔍 ESCANEO PRE-INSTALACIÓN" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Speak "Escaneando tu sistema"

if (-not (Test-Internet)) {
    Write-Fail "Sin conexión a internet"
    Speak "No hay conexión a internet"
    Read-Host; exit 1
}

Test-DiskSpace | Out-Null
Test-Antivirus | Out-Null
Fix-CommonIssues

Write-Host ""
Write-Host "  📊 VERSIONES INSTALADAS:" -ForegroundColor Cyan
$nodeVer = Get-CommandVersion "node"
$rustVer = Get-CommandVersion "rustc"
$nodeOk = Test-VersionOk "Node.js" $nodeVer $script:Config.MinNodeVersion
$rustOk = Test-VersionOk "Rust"    $rustVer $script:Config.MinRustVersion

$systemState = @{
    Chocolatey = Test-Command "choco"
    NodeJs     = $nodeOk
    Rust       = $rustOk
    Git        = Test-Command "git"
    Yarn       = Test-Command "yarn"
    Code       = Test-Command "code"
}

Show-Toast -Title "Escaneo completado" -Message "Sistema verificado" -Icon "✅"
Pause-User "Presiona ENTER para continuar"

# ═══════════════════════════════════════════════════════════════
# 📋 GITHUB API
# ═══════════════════════════════════════════════════════════════
Clear-Host; Show-Header
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host "  📋 CONFIGURACIÓN DE GITHUB" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host ""
Speak "Necesito tu token de GitHub"
Write-Info "Necesito tu Personal Access Token"
Write-Host ""
Write-Host "  Si no lo tienes: https://github.com/settings/tokens" -ForegroundColor Cyan
Write-Host "  → Generate new token (classic) → marca 'repo'" -ForegroundColor Gray
Write-Host ""
$openTokens = Ask-User "¿Abrir la página de tokens? (S/N)" "N"
if ($openTokens -eq "S" -or $openTokens -eq "s") {
    Start-Process "https://github.com/settings/tokens"
    Pause-User "Cuando tengas el token, presiona ENTER"
}

$tokenResult = Test-GitHubToken -Token $GitHubToken
if (-not $tokenResult.Success) {
    Write-Fail "Token inválido"
    Speak "Token inválido"
    Read-Host; exit 1
}
$GitHubToken = $tokenResult.Token
Show-Toast -Title "GitHub validado" -Message "Hola $($tokenResult.User.login)" -Icon "🔐"

# ═══════════════════════════════════════════════════════════════
# 1/7  CHOCOLATEY
# ═══════════════════════════════════════════════════════════════
Write-Step "1/7" "Chocolatey" "Gestor de paquetes de Windows"
Speak "Paso uno. Verificando Chocolatey."

if ($systemState.Chocolatey) {
    Write-Skip "Chocolatey ya está instalado"
    Register-Result "Chocolatey" "Skipped"
} else {
    Write-Task "Instalando Chocolatey..."
    try {
        Set-ExecutionPolicy Bypass -Scope Process -Force
        Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1')) *>&1 | Out-Null
        Refresh-Path
        Write-Success "Chocolatey instalado"
        Register-Result "Chocolatey" "Success"
    } catch {
        Write-Fail "Error: $_"
        Register-Result "Chocolatey" "Failed" $_.ToString()
    }
}

# ═══════════════════════════════════════════════════════════════
# 2/7  INSTALACIÓN PARALELA
# ═══════════════════════════════════════════════════════════════
Write-Step "2/7" "Herramientas base (paralelo)" "Node.js, Rust, Git"
Speak "Paso dos. Instalando herramientas."

$toInstall = @()
if (-not $systemState.NodeJs) { $toInstall += "nodejs-lts" }
if (-not $systemState.Rust)   { $toInstall += "rust" }
if (-not $systemState.Git)    { $toInstall += "git" }

$vsBuildToolsPath = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2022\BuildTools"
if (-not (Test-Path $vsBuildToolsPath)) {
    Write-Task "Instalando VS Build Tools (10-15 min)..."
    choco install -y visualstudio2022buildtools visualstudio2022-workload-vctools --no-progress
}

if ($toInstall.Count -gt 0) {
    Install-Parallel -Packages $toInstall
    Register-Result "Herramientas base" "Success" ($toInstall -join ", ")
} else {
    Write-Skip "Ya están todas instaladas"
    Register-Result "Herramientas base" "Skipped"
}
Show-Toast -Title "Herramientas instaladas" -Message "Todo listo" -Icon "🛠️"

# ═══════════════════════════════════════════════════════════════
# 3/7  VERIFICACIÓN
# ═══════════════════════════════════════════════════════════════
Write-Step "3/7" "Verificación" "Comprobando versiones"
Speak "Paso tres. Verificando."

$nodeVer = Get-CommandVersion "node"
$rustVer = Get-CommandVersion "rustc"
$nodeOk = Test-VersionOk "Node.js" $nodeVer $script:Config.MinNodeVersion
$rustOk = Test-VersionOk "Rust"    $rustVer $script:Config.MinRustVersion

if (-not $nodeOk -or -not $rustOk) {
    $upgrade = Ask-User "¿Actualizar versiones obsoletas? (S/N)" "S"
    if ($upgrade -eq "S" -or $upgrade -eq "s") {
        if (-not $nodeOk) { choco upgrade nodejs-lts -y }
        if (-not $rustOk) { choco upgrade rust -y }
        Refresh-Path
    }
}
Register-Result "Verificación" "Success"

# ═══════════════════════════════════════════════════════════════
# 4/7  YARN
# ═══════════════════════════════════════════════════════════════
Write-Step "4/7" "Yarn" "Instalando gestor de paquetes"
Speak "Paso cuatro. Yarn."

if (Test-Command "yarn") {
    Write-Skip "Yarn ya instalado ($(yarn --version))"
    Register-Result "Yarn" "Skipped"
} else {
    npm install -g yarn 2>&1 | Out-Null
    Refresh-Path
    if (Test-Command "yarn") {
        Write-Success "Yarn instalado"
        Register-Result "Yarn" "Success"
    } else {
        Write-Fail "Error al instalar Yarn"
        Register-Result "Yarn" "Failed"
    }
}

# ═══════════════════════════════════════════════════════════════
# 5/7  GIT CONFIG
# ═══════════════════════════════════════════════════════════════
Write-Step "5/7" "Configuración de Git" "Identidad y credenciales"
Speak "Paso cinco. Configurando Git."

git config --global user.name  $tokenResult.User.login 2>&1 | Out-Null
if ($tokenResult.User.email) {
    git config --global user.email $tokenResult.User.email 2>&1 | Out-Null
} else {
    $userEmail = Read-Host "  ➤ Tu email de GitHub (no público)"
    git config --global user.email $userEmail 2>&1 | Out-Null
}
git config --global credential.helper store 2>&1 | Out-Null

$credentialsPath = "$HOME\.git-credentials"
"https://$($tokenResult.User.login):$GitHubToken@github.com" | Set-Content -Path $credentialsPath -Encoding UTF8

Write-Success "Git configurado como: $($tokenResult.User.login)"
Write-Success "Credenciales guardadas"
Register-Result "Git Config" "Success"

# ═══════════════════════════════════════════════════════════════
# 6/7  DETECTAR / CLONAR (NUEVO — INTELIGENTE)
# ═══════════════════════════════════════════════════════════════
Write-Step "6/7" "Proyecto DAWN" "Detectando o clonando"
Speak "Paso seis. Preparando el proyecto."

$dawnLocation = Resolve-DawnLocation
$script:Config.ProjectPath = $dawnLocation.Path

Clear-Host; Show-Header
Write-Progress-Bar -Current 6 -Total $script:TotalSteps -Activity "Proyecto DAWN"

switch ($dawnLocation.Action) {
    "skip" {
        Write-Skip "Usando instalación existente sin cambios"
        Write-Success "📂 Ubicación: $($dawnLocation.Path)"
        Register-Result "Clone" "Skipped" "Ya instalado"
    }
    "update" {
        Write-Task "Actualizando con git pull..."
        Set-Location $dawnLocation.Path
        try {
            git pull origin main 2>&1 | ForEach-Object { Write-Host "     $_" -ForegroundColor DarkGray }
            Write-Success "Repositorio actualizado"
            Register-Result "Clone" "Updated" $dawnLocation.Path
        } catch {
            Write-Fail "Error al actualizar: $_"
            Register-Result "Clone" "Failed" $_.ToString()
        }
    }
    "clone" {
        Write-Task "Clonando DAWN en: $($dawnLocation.Path)"
        $parent = Split-Path $dawnLocation.Path -Parent
        if (-not (Test-Path $parent)) {
            New-Item -ItemType Directory -Path $parent -Force | Out-Null
        }
        Set-Location $parent
        $folderName = Split-Path $dawnLocation.Path -Leaf
        git clone "https://$($tokenResult.User.login):$GitHubToken@github.com/$($script:Config.RepoOwner)/$($script:Config.RepoName).git" $folderName 2>&1 | Out-Null

        if (Test-IsDawnProject $dawnLocation.Path) {
            Write-Success "Clonado correctamente en: $($dawnLocation.Path)"
            Register-Result "Clone" "Success" $dawnLocation.Path
        } else {
            Write-Fail "Error al clonar el repo"
            Register-Result "Clone" "Failed"
            Read-Host; exit 1
        }
    }
}

Set-Location $script:Config.ProjectPath
Show-Toast -Title "Proyecto listo" -Message "DAWN en $($script:Config.ProjectPath)" -Icon "📂"

# ═══════════════════════════════════════════════════════════════
# 7/7  DEPENDENCIAS
# ═══════════════════════════════════════════════════════════════
Write-Step "7/7" "Dependencias" "Instalando con Yarn"
Speak "Paso siete. Instalando dependencias."

if (Test-Path "$($script:Config.ProjectPath)\node_modules") {
    Write-Info "node_modules ya existe"
    $reinstall = Ask-User "¿Reinstalar de cero? (S/N)" "N"
    if ($reinstall -eq "S" -or $reinstall -eq "s") {
        Write-Task "Borrando node_modules..."
        Remove-Item -Recurse -Force "$($script:Config.ProjectPath)\node_modules"
        Write-Task "Reinstalando (5-10 min)..."
        yarn install
        if (Test-Path "$($script:Config.ProjectPath)\node_modules") {
            Write-Success "Reinstalado"
            Register-Result "Dependencies" "Success" "Reinstalado"
        } else {
            Write-Fail "Error"
            Register-Result "Dependencies" "Failed"
        }
    } else {
        Write-Skip "Manteniendo dependencias existentes"
        Register-Result "Dependencies" "Skipped"
    }
} else {
    Write-Task "Instalando (5-10 min)..."
    yarn install
    if (Test-Path "$($script:Config.ProjectPath)\node_modules") {
        Write-Success "Dependencias instaladas"
        Register-Result "Dependencies" "Success"
    } else {
        Write-Fail "Error"
        Register-Result "Dependencies" "Failed"
    }
}

# ═══════════════════════════════════════════════════════════════
# 📊 RESUMEN
# ═══════════════════════════════════════════════════════════════
Clear-Host; Show-Header
Speak "Instalación completada"
Play-Sound "success"

Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  📊 RESUMEN" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""

$totalOk = 0; $totalSkip = 0; $totalFail = 0
foreach ($step in $script:StepResults.Keys | Sort-Object) {
    $r = $script:StepResults[$step]
    switch ($r.Status) {
        "Success" { Write-Success "$step"; $totalOk++ }
        "Updated" { Write-Success "$step (actualizado)"; $totalOk++ }
        "Skipped" { Write-Skip "$step"; $totalSkip++ }
        "Failed"  { Write-Fail "$step — $($r.Detail)"; $totalFail++ }
    }
}

Write-Host ""
Write-Host "  ✅ OK: $totalOk  ⏭️ Skip: $totalSkip  ❌ Fail: $totalFail" -ForegroundColor Cyan
Write-Host ""

if ($totalFail -eq 0) {
    Show-Toast -Title "🎉 DAWN Instalado" -Message "Todo listo" -Icon "🎉"
    Speak "Todo listo. Bienvenido al equipo DAWN"
} else {
    Show-Toast -Title "⚠️ Con errores" -Message "Revisa el log" -Icon "⚠️"
    Speak "Instalación completada con errores"
}

Write-Host "  📂 Proyecto: $($script:Config.ProjectPath)" -ForegroundColor Cyan
Write-Host "  📄 Log:      $($script:Config.LogFile)" -ForegroundColor Cyan
Write-Host ""

# ═══════════════════════════════════════════════════════════════
# 🚀 ACCIONES FINALES
# ═══════════════════════════════════════════════════════════════
if (-not $Silent) {
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Magenta
    Write-Host "  🚀 ¿QUÉ HACER AHORA?" -ForegroundColor Magenta
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "  [1] 🎹  Abrir VS Code + Arrancar DAWN" -ForegroundColor Green
    Write-Host "  [2] 💻  Solo abrir VS Code" -ForegroundColor White
    Write-Host "  [3] 📂  Abrir carpeta" -ForegroundColor White
    Write-Host "  [4] 🚪  Salir" -ForegroundColor Gray
    Write-Host ""
    $action = Read-Host "  Elige (1-4)"

    switch ($action) {
        "1" { Open-Project -Path $script:Config.ProjectPath -StartDawn $true; Speak "Abriendo Visual Studio Code y arrancando DAWN" }
        "2" { Open-Project -Path $script:Config.ProjectPath -StartDawn $false; Speak "Abriendo Visual Studio Code" }
        "3" { Start-Process "explorer.exe" -ArgumentList "`"$($script:Config.ProjectPath)`""; Speak "Abriendo carpeta" }
        default { Speak "Hasta pronto" }
    }
} else {
    Open-Project -Path $script:Config.ProjectPath -StartDawn $true
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  🎉 ¡Bienvenido al equipo DAWN!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""

if (-not $Silent) { Read-Host "Presiona ENTER para cerrar" }