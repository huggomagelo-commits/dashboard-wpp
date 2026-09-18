# Roda o schema num Postgres local e confere as regras.
#
#   powershell -File supabase\testes\rodar.ps1
#
# Cria um banco descartável, aplica o ambiente falso do Supabase, aplica o
# schema DUAS VEZES (para provar que é idempotente) e roda as asserções.

$ErrorActionPreference = "Stop"

$psql = "C:\Program Files\PostgreSQL\17\bin\psql.exe"
if (-not (Test-Path $psql)) { throw "psql não encontrado em $psql" }

$env:PGPASSWORD = "postgres"
$aqui  = Split-Path -Parent $MyInvocation.MyCommand.Path
$banco = "painel_teste"

function Rodar($db, $args) {
    & $psql -U postgres -h localhost -p 5432 -d $db -v ON_ERROR_STOP=1 @args
    if ($LASTEXITCODE -ne 0) { throw "psql falhou (saída $LASTEXITCODE)" }
}

Write-Host "`n--- recriando o banco $banco ---" -ForegroundColor Cyan
Rodar "postgres" @("-c", "drop database if exists $banco;")
Rodar "postgres" @("-c", "create database $banco;")

Write-Host "`n--- ambiente que o Supabase traz pronto ---" -ForegroundColor Cyan
Rodar $banco @("-q", "-f", "$aqui\00-ambiente.sql")

Write-Host "`n--- schema (1a vez) ---" -ForegroundColor Cyan
Rodar $banco @("-q", "-f", "$aqui\..\schema.sql")

Write-Host "`n--- schema (2a vez: prova de idempotencia) ---" -ForegroundColor Cyan
Rodar $banco @("-q", "-f", "$aqui\..\schema.sql")

Write-Host "`n--- testes ---" -ForegroundColor Cyan
Rodar $banco @("-f", "$aqui\01-testes.sql")
