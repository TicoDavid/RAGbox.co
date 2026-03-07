# ConnexUS Agent Dispatcher
# Usage: .\dispatch.ps1 -Agent adam -Order "Deploy commit abc123 to ragbox-app"
# Usage: .\dispatch.ps1 -Agent all -OrderFile connexus-ops\orders\deploy-55.md
# Usage: .\dispatch.ps1 -List (show active agents)

param(
    [ValidateSet("adam","jordan","sarah","drinsane","sheldon","all")]
    [string]$Agent,
    [string]$Order,
    [string]$OrderFile,
    [switch]$List,
    [string]$WorkDir = "C:\Users\d0527\RAGbox.co"
)

$agents = @{
    adam     = @{ Role = "DevOps"; Persona = "You are Adam, DevOps engineer for RAGbox.co. Execute infrastructure and deployment tasks. Report results concisely. Working dir: $WorkDir" }
    jordan   = @{ Role = "UI Engineer"; Persona = "You are Jordan, UI junior engineer for RAGbox.co. Execute frontend implementation tasks. Follow design-tokens.css and coding-style.md. Report results concisely. Working dir: $WorkDir" }
    sarah    = @{ Role = "QA/Test"; Persona = "You are Sarah, test engineer for RAGbox.co. Run tests, verify regressions, report results as tables. Working dir: $WorkDir" }
    drinsane = @{ Role = "QA Certifier"; Persona = "You are Dr. Insane, QA certifier for RAGbox.co. Certify deployments against test checklists. Be thorough, report PASS/FAIL per item. Working dir: $WorkDir" }
    sheldon  = @{ Role = "Backend"; Persona = "You are Sheldon, backend engineer for RAGbox.co. Execute backend/Go/Node tasks. Report results concisely. Working dir: $WorkDir" }
}

if ($List) {
    Write-Host "`nConnexUS Agents:" -ForegroundColor Cyan
    foreach ($name in $agents.Keys | Sort-Object) {
        Write-Host "  $name — $($agents[$name].Role)" -ForegroundColor White
    }
    return
}

if (-not $Agent) {
    Write-Host "Usage: .\dispatch.ps1 -Agent <name> -Order 'task description'" -ForegroundColor Yellow
    Write-Host "       .\dispatch.ps1 -Agent all -OrderFile path\to\orders.md" -ForegroundColor Yellow
    Write-Host "       .\dispatch.ps1 -List" -ForegroundColor Yellow
    return
}

# Build the prompt
$prompt = ""
if ($OrderFile -and (Test-Path $OrderFile)) {
    $prompt = Get-Content $OrderFile -Raw
} elseif ($Order) {
    $prompt = $Order
} else {
    Write-Host "ERROR: Provide -Order or -OrderFile" -ForegroundColor Red
    return
}

function Dispatch($name) {
    $persona = $agents[$name].Persona
    $fullPrompt = "$persona`n`nORDER:`n$prompt"
    Write-Host "Dispatching to $name ($($agents[$name].Role))..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$WorkDir'; claude -p '$($fullPrompt -replace "'","''")'"
}

if ($Agent -eq "all") {
    foreach ($name in $agents.Keys) { Dispatch $name }
} else {
    Dispatch $Agent
}

Write-Host "`nDispatched." -ForegroundColor Cyan
