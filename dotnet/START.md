# Run the .NET RetailOps API (dotnet)

Loads environment from `backend/.env` (mapping Node-style keys to .NET-style `Section__Key`),
then starts the API with `dotnet run`.

Requires:
- .NET SDK 10.0.302+
- SQL Server reachable (`DB_SERVER`/`DB_PASSWORD` from `backend/.env`)
- JWT secrets present in `backend/.env` (`JWT_SECRET`, `JWT_REFRESH_SECRET`)

```powershell
# From the repo root
powershell -ExecutionPolicy Bypass -File scripts\run-dotnet-api.ps1
```

The API starts at `http://localhost:5158` (also HTTPS `https://localhost:7123`).

# Environment variables

| .NET variable                  | Source (backend/.env)      | Default            |
|--------------------------------|----------------------------|--------------------|
| `DB_SERVER`                    | `DB_SERVER`                | `31.97.62.95`      |
| `DB_NAME`                      | `DB_NAME`                  | `retailops`        |
| `DB_USER`                      | `DB_USER`                  | `sa`               |
| `DB_PASSWORD`                  | `DB_PASSWORD`              | —                  |
| `DB_PORT`                      | `DB_PORT`                  | `1433`             |
| `DB_ENCRYPT`                   | `DB_ENCRYPT`               | `false`            |
| `Jwt__AccessSecret`            | `JWT_SECRET`               | — (required)       |
| `Jwt__RefreshSecret`           | `JWT_REFRESH_SECRET`       | — (required)       |
| `Smtp__Host` / `Port` / `Secure` | `SMTP_HOST`/`SMTP_PORT`/`SMTP_SECURE` | `smtp.gmail.com` / `587` / `false` |
| `Smtp__User` / `Password` / `From` | `SMTP_USER`/`SMTP_PASSWORD`/`SMTP_FROM` | — |
| `RetailOps__DashboardUrl`      | (uses `FRONTEND_URL`)      | `https://data.brandcentral.in` |

Notes:
- Missing `Jwt__AccessSecret`/`Jwt__RefreshSecret` aborts startup (fail-fast).
- DB password is read from `.env` at runtime, never committed.
- Connection string overrides: set `RetailOps__ConnectionStrings__Default` to bypass all `DB_*` vars.

# Running from Visual Studio

1. Open `dotnet\RetailOps.slnx` in Visual Studio.
2. Set the environment variables once (PowerShell, user scope):

   ```powershell
   $env:DB_SERVER = "31.97.62.95"
   $env:DB_NAME   = "retailops"
   $env:DB_USER   = "sa"
   $env:DB_PASSWORD = "<from backend/.env>"
   $env:DB_PORT   = "1433"
   $env:DB_ENCRYPT = "false"
   $env:Jwt__AccessSecret   = "<from backend/.env JWT_SECRET>"
   $env:Jwt__RefreshSecret  = "<from backend/.env JWT_REFRESH_SECRET>"
   [Environment]::SetEnvironmentVariable('DB_SERVER', $env:DB_SERVER, 'User')
   [Environment]::SetEnvironmentVariable('DB_NAME', $env:DB_NAME, 'User')
   [Environment]::SetEnvironmentVariable('DB_USER', $env:DB_USER, 'User')
   [Environment]::SetEnvironmentVariable('DB_PASSWORD', $env:DB_PASSWORD, 'User')
   [Environment]::SetEnvironmentVariable('DB_PORT', $env:DB_PORT, 'User')
   [Environment]::SetEnvironmentVariable('DB_ENCRYPT', $env:DB_ENCRYPT, 'User')
   [Environment]::SetEnvironmentVariable('Jwt__AccessSecret', $env:Jwt__AccessSecret, 'User')
   [Environment]::SetEnvironmentVariable('Jwt__RefreshSecret', $env:Jwt__RefreshSecret, 'User')
   ```

   (Restart Visual Studio so it picks up user-scope env vars.)
3. Set `RetailOps.Api` as the startup project and press **F5** (profile `http` or `https`).

   Alternatively, add the variables under **Project Properties → Debug → Environment variables** in
   the `launchSettings.json` (do NOT commit real secrets).

# Running from CLI

```powershell
# Load backend/.env (mapped) + run
powershell -ExecutionPolicy Bypass -File scripts\run-dotnet-api.ps1

# Or do it manually
$env:Jwt__AccessSecret  = (Get-Content backend\.env | Where-Object { $_ -match '^JWT_SECRET=' } | ForEach-Object { $_.Substring(11).Trim() })
$env:Jwt__RefreshSecret = (Get-Content backend\.env | Where-Object { $_ -match '^JWT_REFRESH_SECRET=' } | ForEach-Object { $_.Substring(19).Trim() })
dotnet run --project dotnet\RetailOps.Api --launch-profile http
```

# Verify it's up

- Swagger/OpenAPI (dev): `http://localhost:5158/openapi/v1.json`
- Smoke login (wrong password → expect generic 401):

  ```powershell
  Invoke-RestMethod -Method Post -Uri "http://localhost:5158/api/auth/login" `
    -ContentType "application/json" `
    -Body '{"email":"chintan.patel@brandcentral.in","password":"wrong"}'
  ```

# Frontend dev server

The Vite app proxies `/api` to the API. Point it at the .NET port instead of the Node port:

```js
// vite.config.js → server.proxy
'/api': {
  target: 'http://localhost:5158',   // was http://localhost:3001
  changeOrigin: true,
},
```

```powershell
npm install
npm run dev
```
