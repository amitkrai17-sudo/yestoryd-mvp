# verify-change.ps1
#
# Post-change verification for Yestoryd. Run AFTER any change that touches >3 files,
# BEFORE reporting the task done.
#
# Each check below greps for a forbidden pattern. Empty output = clean. Any
# output = violation to fix before report-done.
#
# Usage (from repo root D:\yestoryd-mvp):
#   pwsh -File scripts/verify-change.ps1
#
# Notes:
#   - Translated from the original bash grep block in CLAUDE.md (2026-05-29).
#   - Uses Select-String against the same file roots (app, components, lib).
#   - Lines starting with `//` are excluded as comments-of-self-reference.
#
# ---------------------------------------------------------------------------
# Local Build Discipline (MANDATORY before push)
#
# Local `npm run build` is mandatory before push for any commit that:
# - Adds new Supabase queries with .eq() / .single() / .maybeSingle() chains
# - Adds new SELECT columns or JOINs
# - Touches files with new variable references (e.g. lifting a query to a new
#   scope, switching between try blocks)
# - Modifies more than 5 files in one commit
#
# Skip the build only for: doc-only commits, migration-only commits,
# comment-only changes, or single-line config tweaks.
#
# Reasoning: Vercel build budget concerns are NEVER worth a divergent
# production state. A failed Vercel deploy with already-applied DB migrations
# leaves production code stale while DB expects new shape — silent runtime
# failures result. Local build catches TS2345 / type errors that Vercel would
# catch 3 minutes later, but without the cost of a broken deploy.
#
# The 2026-04-25 four-template alignment incident demonstrated this: two
# consecutive deploys ERRORED on nullable-type guards (commits a461f731 and
# 698ff708), leaving DB migrations applied while production code stayed on
# stale deploy. 60-minute divergence window — zero send attempts during it by
# luck only.
# ---------------------------------------------------------------------------

$ErrorActionPreference = 'Continue'
$violations = 0

function Run-Check {
    param(
        [string]$Name,
        [scriptblock]$Block
    )
    Write-Host ""
    Write-Host "=== $Name ===" -ForegroundColor Cyan
    $hits = & $Block
    if ($hits) {
        $hits | ForEach-Object { Write-Host $_ -ForegroundColor Red }
        $script:violations++
    } else {
        Write-Host "OK (no matches)" -ForegroundColor Green
    }
}

$roots = @('app', 'components', 'lib') | Where-Object { Test-Path $_ }
$includeExts = @('*.ts', '*.tsx')

function Get-CodeFiles {
    param([string[]]$Excludes = @())
    Get-ChildItem -Path $roots -Recurse -Include $includeExts -ErrorAction SilentlyContinue |
        Where-Object {
            $p = $_.FullName
            if ($p -match 'node_modules') { return $false }
            foreach ($ex in $Excludes) {
                if ($p -match $ex) { return $false }
            }
            return $true
        }
}

# 1. No hardcoded phone numbers leaked (except company-config.ts)
Run-Check '1. Hardcoded phone numbers' {
    Get-CodeFiles -Excludes @('company-config\.ts') |
        Select-String -Pattern '8976287997|8591287997|9687606177|98765' |
        Where-Object { $_.Line -notmatch '^\s*//' } |
        ForEach-Object { "{0}:{1}: {2}" -f $_.Path, $_.LineNumber, $_.Line.Trim() }
}

# 2. No hardcoded emails leaked (except company-config.ts)
Run-Check '2. Hardcoded emails' {
    Get-CodeFiles -Excludes @('company-config\.ts') |
        Select-String -Pattern 'engage@yestoryd|system@yestoryd|amitkrai17@|rucha\.rai@' |
        Where-Object { $_.Line -notmatch '^\s*//' } |
        ForEach-Object { "{0}:{1}: {2}" -f $_.Path, $_.LineNumber, $_.Line.Trim() }
}

# 3. No hardcoded prices leaked (except pricing-config.ts and types/)
Run-Check '3. Hardcoded prices' {
    Get-CodeFiles -Excludes @('pricing-config\.ts', '\\types\\') |
        Select-String -Pattern '\b5999\b|\b6999\b|\b1499\b|\b7499\b|\b9999\b' |
        Where-Object { $_.Line -notmatch '^\s*//' } |
        ForEach-Object { "{0}:{1}: {2}" -f $_.Path, $_.LineNumber, $_.Line.Trim() }
}

# 4. No hardcoded session counts leaked (`|| 9`, `?? 9`, `= 9;` patterns)
Run-Check '4. Hardcoded session counts' {
    Get-CodeFiles |
        Select-String -Pattern '\|\| 9\b|\?\? 9\b|= 9;' |
        Where-Object { $_.Line -notmatch '^\s*//' } |
        ForEach-Object { "{0}:{1}: {2}" -f $_.Path, $_.LineNumber, $_.Line.Trim() }
}

# 5. No emoji in rendered output (Unicode pictographic / symbol ranges)
Run-Check '5. Emoji in rendered output' {
    $emojiPattern = '[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]'
    Get-CodeFiles |
        Select-String -Pattern $emojiPattern |
        ForEach-Object { "{0}:{1}: {2}" -f $_.Path, $_.LineNumber, $_.Line.Trim() }
}

# 6. Auth check on any new/modified API route (MANUAL — left as guidance)
Write-Host ""
Write-Host "=== 6. Auth check on new/modified API routes (MANUAL) ===" -ForegroundColor Yellow
Write-Host "Verify every non-public route under app/api/ (except webhooks/ and cron/)"
Write-Host "has auth within first 20 lines. Use `withApiHandler()` from lib/api/with-api-handler.ts."

# 7. No new `as any` introduced in changed files (MANUAL — needs git diff scope)
Write-Host ""
Write-Host "=== 7. No new 'as any' in changed files (MANUAL) ===" -ForegroundColor Yellow
Write-Host "Run: git diff --name-only HEAD | % { Select-String -Path `$_ -Pattern 'as any' }"

# 8. No inline Gemini client instantiation (except lib/gemini/client.ts)
Run-Check '8. Inline new GoogleGenerativeAI()' {
    Get-CodeFiles -Excludes @('lib\\gemini\\client\.ts', 'lib/gemini/client\.ts') |
        Select-String -Pattern 'new GoogleGenerativeAI' |
        ForEach-Object { "{0}:{1}: {2}" -f $_.Path, $_.LineNumber, $_.Line.Trim() }
}

Write-Host ""
if ($violations -eq 0) {
    Write-Host "All automated checks passed. Re-do manual checks 6 and 7 by hand." -ForegroundColor Green
    exit 0
} else {
    Write-Host "$violations check(s) flagged violations. Fix before reporting done." -ForegroundColor Red
    exit 1
}
