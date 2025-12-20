# Yestoryd Rebrand Script: Vedant AI → rAI
# Run from C:\yestoryd-mvp folder
# Usage: powershell -ExecutionPolicy Bypass -File rebrand-to-rai.ps1

Write-Host "🚀 Starting Yestoryd Rebrand: Vedant AI → rAI" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# Define replacements (order matters - more specific first)
$replacements = @(
    # Specific phrases first
    @{ Old = "Vedant AI Feedback"; New = "rAI Analysis" },
    @{ Old = "Vedant AI says"; New = "rAI says" },
    @{ Old = "Vedant AI's"; New = "rAI's" },
    @{ Old = "Meet Vedant AI"; New = "Meet rAI" },
    @{ Old = "Vedant AI analyzes"; New = "rAI analyzes" },
    @{ Old = "Vedant AI listens"; New = "rAI listens" },
    @{ Old = "Vedant AI pinpointed"; New = "rAI pinpointed" },
    @{ Old = "Chat with Vedant"; New = "Chat with rAI" },
    @{ Old = "with Vedant AI"; New = "with rAI" },
    @{ Old = "Powered by Vedant AI"; New = "Powered by rAI" },
    @{ Old = "via Vedant AI"; New = "via rAI" },
    @{ Old = "from Vedant AI"; New = "from rAI" },
    
    # Variable names (camelCase)
    @{ Old = "vedantScore"; New = "raiScore" },
    @{ Old = "vedantAnalysis"; New = "raiAnalysis" },
    @{ Old = "showVedantChat"; New = "showRaiChat" },
    @{ Old = "startVedantConversation"; New = "startRaiConversation" },
    @{ Old = "VEDANT_SYSTEM_PROMPT"; New = "RAI_SYSTEM_PROMPT" },
    
    # Object keys
    @{ Old = "vedant:"; New = "rai:" },
    @{ Old = ".vedant"; New = ".rai" },
    
    # Display text
    @{ Old = "Vedant AI"; New = "rAI" },
    @{ Old = "Vedant:"; New = "rAI:" },
    @{ Old = "Vedant,"; New = "rAI," },
    @{ Old = "Vedant "; New = "rAI " },
    @{ Old = "'Vedant'"; New = "'rAI'" },
    @{ Old = '"Vedant"'; New = '"rAI"' },
    
    # Image alt text
    @{ Old = 'alt="Vedant'; New = 'alt="rAI' },
    
    # System prompts - standalone Vedant at start of sentence
    @{ Old = "I'm Vedant"; New = "I'm rAI" },
    @{ Old = "as Vedant"; New = "as rAI" },
    
    # Comments
    @{ Old = "Vedant-powered"; New = "rAI-powered" },
    @{ Old = "Gemini-powered Vedant"; New = "Gemini-powered rAI" },
    
    # Tagline update
    @{ Old = "Your Reading Coach"; New = "Your AI Reading Coach" }
)

# Files to update
$files = @(
    "app\admin\coach-applications\page.tsx",
    "app\api\certificate\send\route.ts",
    "app\api\chat\route.ts",
    "app\api\coach-assessment\calculate-score\route.ts",
    "app\api\coach-assessment\chat\route.ts",
    "app\assessment\page.tsx",
    "app\assessment\results\[id]\page.tsx",
    "app\HomePageClient.tsx",
    "app\page.tsx",
    "app\parent\dashboard\page.tsx",
    "app\parent\login\page.tsx",
    "app\parent\support\page.tsx",
    "app\yestoryd-academy\assessment\page.tsx",
    "app\yestoryd-academy\page.tsx"
)

$totalChanges = 0

foreach ($file in $files) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw -Encoding UTF8
        $originalContent = $content
        $fileChanges = 0
        
        foreach ($r in $replacements) {
            $count = ([regex]::Matches($content, [regex]::Escape($r.Old))).Count
            if ($count -gt 0) {
                $content = $content -replace [regex]::Escape($r.Old), $r.New
                $fileChanges += $count
            }
        }
        
        if ($content -ne $originalContent) {
            Set-Content $file -Value $content -Encoding UTF8 -NoNewline
            Write-Host "✅ $file - $fileChanges changes" -ForegroundColor Green
            $totalChanges += $fileChanges
        } else {
            Write-Host "⏭️ $file - No changes needed" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ $file - File not found" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "✨ Rebrand complete! Total changes: $totalChanges" -ForegroundColor Cyan
Write-Host ""
Write-Host "📌 Next steps:" -ForegroundColor Yellow
Write-Host "1. Rename image file:" -ForegroundColor White
Write-Host "   ren public\images\vedant-mascot.png rai-mascot.png" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Update image references:" -ForegroundColor White
Write-Host "   Run: powershell -Command `"(Get-ChildItem -Path app -Recurse -Filter *.tsx).FullName | ForEach-Object { (Get-Content `$_ -Raw) -replace 'vedant-mascot.png', 'rai-mascot.png' | Set-Content `$_ -NoNewline }`"" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Deploy:" -ForegroundColor White
Write-Host "   git add ." -ForegroundColor Gray
Write-Host "   git commit -m 'Rebrand: Vedant AI → rAI'" -ForegroundColor Gray
Write-Host "   git push" -ForegroundColor Gray
