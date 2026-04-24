$body = @{
    action = "login-password"
    email = "admin@school.edu"
    password = "admin123"
} | ConvertTo-Json

try {
    $res = Invoke-RestMethod -Uri "http://127.0.0.1:5001/api/v1/auth" -Method Post -ContentType "application/json" -Body $body
    Write-Host "Admin Login: SUCCESS" -ForegroundColor Green
} catch {
    Write-Host "Admin Login: FAILED" -ForegroundColor Red
}

$body2 = @{
    action = "login-password"
    email = "priya.reviewer@school.edu"
    password = "reviewer123"
} | ConvertTo-Json

try {
    $res2 = Invoke-RestMethod -Uri "http://127.0.0.1:5001/api/v1/auth" -Method Post -ContentType "application/json" -Body $body2
    Write-Host "Reviewer Login: SUCCESS" -ForegroundColor Green
} catch {
    Write-Host "Reviewer Login: FAILED" -ForegroundColor Red
}
