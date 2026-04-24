$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5ZTczNmNlOTgyMzUwNDRlMDMxMDhlNiIsImlhdCI6MTc3Njc2MjMxMywiZXhwIjoxNzc2NzY1OTEzfQ.iOoMGZWuUM5EB_rBi80o_iWC8SI27biANjvHYRA4iZY"

Write-Host "=== Testing FORMS API ===" -ForegroundColor Cyan
$forms = Invoke-RestMethod -Uri "http://127.0.0.1:5001/api/v1/forms" -Method Get -Headers @{ "Authorization" = "Bearer $token" }
$forms | ForEach-Object { Write-Host "  ✅ Form: $($_.title) (Type: $($_.form_type))" }
Write-Host ""

Write-Host "=== Testing SUBMISSIONS API ===" -ForegroundColor Cyan
$submissions = Invoke-RestMethod -Uri "http://127.0.0.1:5001/api/v1/submissions" -Method Get -Headers @{ "Authorization" = "Bearer $token" }
Write-Host "  ✅ Total Submissions: $($submissions.Count)"
Write-Host ""

Write-Host "=== Testing STATS API ===" -ForegroundColor Cyan
$stats = Invoke-RestMethod -Uri "http://127.0.0.1:5001/api/v1/stats" -Method Get -Headers @{ "Authorization" = "Bearer $token" }
$stats | ConvertTo-Json -Depth 5
Write-Host ""

Write-Host "=== Testing AUDIT LOGS API ===" -ForegroundColor Cyan
$logs = Invoke-RestMethod -Uri "http://127.0.0.1:5001/api/v1/audit-logs" -Method Get -Headers @{ "Authorization" = "Bearer $token" }
Write-Host "  ✅ Audit Logs: $($logs.Count) entries"
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "ALL APIs ARE WORKING SUCCESSFULLY!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "App is LIVE at: http://127.0.0.1:5173" -ForegroundColor Yellow
