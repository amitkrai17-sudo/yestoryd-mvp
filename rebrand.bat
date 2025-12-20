@echo off
echo ================================================
echo  Yestoryd Rebrand: Vedant AI to rAI
echo ================================================
echo.
echo This will replace all "Vedant" references with "rAI"
echo.
pause

echo.
echo Step 1: Running PowerShell rebrand script...
powershell -ExecutionPolicy Bypass -File rebrand-to-rai.ps1

echo.
echo Step 2: Renaming mascot image...
if exist "public\images\vedant-mascot.png" (
    ren "public\images\vedant-mascot.png" "rai-mascot.png"
    echo ✓ Renamed vedant-mascot.png to rai-mascot.png
) else (
    echo ! Image file not found at public\images\vedant-mascot.png
)

echo.
echo Step 3: Updating image references in code...
powershell -Command "(Get-ChildItem -Path app -Recurse -Filter *.tsx).FullName | ForEach-Object { (Get-Content $_ -Raw) -replace 'vedant-mascot.png', 'rai-mascot.png' | Set-Content $_ -NoNewline }"
echo ✓ Updated image references

echo.
echo ================================================
echo  Rebrand complete!
echo ================================================
echo.
echo Next: Run these commands to deploy:
echo   git add .
echo   git commit -m "Rebrand: Vedant AI to rAI"
echo   git push
echo.
pause
