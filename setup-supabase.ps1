# Supabase Database Setup Script
$SUPABASE_URL = "https://wcecsvujnooyrkkcqutj.supabase.co"
$SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjZWNzdnVqbm9veXJra2NxdXRqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzIxNTQ5OSwiZXhwIjoyMDc4NzkxNDk5fQ.gc9zMTdnqi4GgzlatXQjAznv0rgQ1Fh3Ba1KyA1wTtI"

Write-Host "Setting up Supabase database..." -ForegroundColor Cyan
Write-Host ""

# Test connection by checking if agents table exists
Write-Host "Checking database connection..." -ForegroundColor Yellow

try {
    $headers = @{
        "apikey" = $SERVICE_KEY
        "Authorization" = "Bearer $SERVICE_KEY"
        "Content-Type" = "application/json"
    }
    
    $uri = $SUPABASE_URL + '/rest/v1/agents?select=id&limit=1'
    $response = Invoke-RestMethod -Uri $uri -Headers $headers -Method Get -ErrorAction Stop
    
    Write-Host "Database connection successful!" -ForegroundColor Green
    Write-Host "Tables already exist!" -ForegroundColor Green
    Write-Host ""
    
    # Check for agents
    $agentsUri = $SUPABASE_URL + '/rest/v1/agents?select=*'
    $agentsResponse = Invoke-RestMethod -Uri $agentsUri -Headers $headers -Method Get
    
    if ($agentsResponse.Count -gt 0) {
        Write-Host "Found $($agentsResponse.Count) agent(s):" -ForegroundColor Green
        foreach ($agent in $agentsResponse) {
            Write-Host "   - $($agent.name) (ID: $($agent.id))" -ForegroundColor White
        }
    }
    else {
        Write-Host "No agents found. Creating default agent..." -ForegroundColor Yellow
        
        $agentData = @{
            name = "Pagrindinis asistentas"
            description = "Lietuviškai kalbantis balso asistentas"
            system_prompt = "Tu esi naudingas balso asistentas. Visada atsakyk lietuvių kalba. Būk mandagus, aiškus ir glaustus."
            model_id = "eleven_v3"
        } | ConvertTo-Json
        
        $createUri = $SUPABASE_URL + '/rest/v1/agents'
        $newAgent = Invoke-RestMethod -Uri $createUri -Headers $headers -Method Post -Body $agentData
        Write-Host "Default agent created!" -ForegroundColor Green
    }
    
}
catch {
    Write-Host "Tables do not exist yet." -ForegroundColor Red
    Write-Host ""
    Write-Host "Please create tables manually:" -ForegroundColor Yellow
    Write-Host "1. Go to: https://supabase.com/dashboard/project/wcecsvujnooyrkkcqutj/sql" -ForegroundColor White
    Write-Host "2. Click 'New Query'" -ForegroundColor White
    Write-Host "3. Copy the contents of 'create-tables.sql'" -ForegroundColor White
    Write-Host "4. Paste and run the query" -ForegroundColor White
    Write-Host "5. Run this script again" -ForegroundColor White
    Write-Host ""
}

Write-Host ""
Write-Host "Database setup complete!" -ForegroundColor Green
