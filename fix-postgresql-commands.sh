#!/bin/bash

# Script para corrigir comandos PostgreSQL com erro "-u: command not found"
# Este erro ocorre quando o comando sudo -u postgres não funciona corretamente

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERRO] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

echo "🔧 Corrigindo comandos PostgreSQL"
echo "================================"

# Verificar se está executando como root
if [[ $EUID -ne 0 ]]; then
   error "Este script deve ser executado como root"
   exit 1
fi

# Configurações do banco
DB_NAME="ligai"
DB_USER="ligai"
DB_PASSWORD="ligai123"

log "Configurando banco de dados PostgreSQL..."

# Verificar se PostgreSQL está instalado
if ! command -v psql &> /dev/null; then
    error "PostgreSQL não está instalado!"
    exit 1
fi

# Verificar se o serviço está rodando
if ! systemctl is-active --quiet postgresql; then
    log "Iniciando serviço PostgreSQL..."
    systemctl start postgresql
    systemctl enable postgresql
fi

# Criar usuário (método corrigido)
log "Verificando usuário do banco: $DB_USER"
USER_EXISTS=$(su - postgres -c "psql -t -c \"SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'\"" 2>/dev/null | grep -c 1 || echo "0")

if [ "$USER_EXISTS" -eq "0" ]; then
    log "Criando usuário do banco: $DB_USER"
    su - postgres -c "psql -c \"CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';\""
else
    log "Usuário $DB_USER já existe, atualizando senha..."
    su - postgres -c "psql -c \"ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';\""
fi

# Criar banco (método corrigido)
log "Verificando banco de dados: $DB_NAME"
DB_EXISTS=$(su - postgres -c "psql -lqt" | cut -d \| -f 1 | grep -w "$DB_NAME" | wc -l)

if [ "$DB_EXISTS" -eq "0" ]; then
    log "Criando banco de dados: $DB_NAME"
    su - postgres -c "psql -c \"CREATE DATABASE $DB_NAME OWNER $DB_USER;\""
else
    log "Banco de dados $DB_NAME já existe"
fi

# Configurar permissões
log "Configurando permissões..."
su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;\""
su - postgres -c "psql -c \"ALTER USER $DB_USER CREATEDB;\""

# Configurar acesso local
log "Configurando acesso ao PostgreSQL..."

# Backup da configuração
PG_VERSION=$(ls /etc/postgresql/ | head -n1)
PG_HBA_FILE="/etc/postgresql/$PG_VERSION/main/pg_hba.conf"

if [ -f "$PG_HBA_FILE" ]; then
    cp "$PG_HBA_FILE" "$PG_HBA_FILE.backup.$(date +%Y%m%d_%H%M%S)"
    
    # Adicionar entrada para acesso local se não existir
    if ! grep -q "local.*$DB_NAME.*$DB_USER.*md5" "$PG_HBA_FILE"; then
        echo "local   $DB_NAME   $DB_USER   md5" >> "$PG_HBA_FILE"
        log "Configuração de acesso adicionada"
    fi
    
    # Reiniciar PostgreSQL
    systemctl restart postgresql
    log "PostgreSQL reiniciado"
else
    error "Arquivo pg_hba.conf não encontrado em $PG_HBA_FILE"
fi

# Testar conexão
log "Testando conexão com o banco..."
if PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &>/dev/null; then
    log "✅ Conexão com PostgreSQL funcionando!"
    log "DATABASE_URL: postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME"
else
    error "❌ Falha na conexão com PostgreSQL"
    exit 1
fi

log "✅ PostgreSQL configurado com sucesso!"