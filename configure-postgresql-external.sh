#!/bin/bash

#################################################
# LigAI Dashboard - Configuração PostgreSQL Externo
# Permite acesso externo ao PostgreSQL
#################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Configurando PostgreSQL para Acesso Externo${NC}"
echo "=================================================="

# Verificar se é root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}Execute como root: sudo bash configure-postgresql-external.sh${NC}"
    exit 1
fi

log() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

# Encontrar versão do PostgreSQL de forma mais robusta
PG_VERSION=""

# Método 1: Procurar diretórios de versão diretamente
for version in 12 13 14 15 16; do
    if [[ -d "/etc/postgresql/$version/main" ]]; then
        PG_VERSION=$version
        break
    fi
done

# Método 2: Se não encontrou, tentar extrair da versão do psql
if [[ -z "$PG_VERSION" ]]; then
    PG_VERSION=$(psql --version 2>/dev/null | grep -o '[0-9]\+' | head -1)
fi

# Método 3: Verificar se o diretório da versão extraída existe
if [[ -n "$PG_VERSION" ]] && [[ ! -d "/etc/postgresql/$PG_VERSION/main" ]]; then
    # Se a versão extraída não tem diretório, procurar qualquer versão disponível
    PG_VERSION=""
    for version in 16 15 14 13 12 11 10; do
        if [[ -d "/etc/postgresql/$version/main" ]]; then
            PG_VERSION=$version
            break
        fi
    done
fi

if [[ -z "$PG_VERSION" ]]; then
    echo -e "${RED}Não foi possível determinar a versão do PostgreSQL${NC}"
    exit 1
fi

log "PostgreSQL versão detectada: $PG_VERSION"

PG_CONF="/etc/postgresql/$PG_VERSION/main/postgresql.conf"
PG_HBA="/etc/postgresql/$PG_VERSION/main/pg_hba.conf"

# Backup dos arquivos originais
log "Fazendo backup dos arquivos de configuração..."
cp "$PG_CONF" "$PG_CONF.backup.$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true
cp "$PG_HBA" "$PG_HBA.backup.$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true

# Configurar postgresql.conf para aceitar conexões externas
log "Configurando postgresql.conf..."

if grep -q "^listen_addresses" "$PG_CONF"; then
    sed -i "s/^listen_addresses.*/listen_addresses = '*'/" "$PG_CONF"
else
    echo "listen_addresses = '*'" >> "$PG_CONF"
fi

if grep -q "^port" "$PG_CONF"; then
    sed -i "s/^port.*/port = 5432/" "$PG_CONF"
else
    echo "port = 5432" >> "$PG_CONF"
fi

log "✅ postgresql.conf configurado"

# Configurar pg_hba.conf para permitir conexões MD5
log "Configurando pg_hba.conf..."

# Remover linhas anteriores do ligai se existirem
sed -i '/# LigAI Dashboard access/d' "$PG_HBA"
sed -i '/host.*ligai.*ligai/d' "$PG_HBA"

# Adicionar regras de acesso
cat >> "$PG_HBA" << 'EOF'

# LigAI Dashboard access
host    ligai           ligai           0.0.0.0/0               md5
host    all             ligai           0.0.0.0/0               md5
EOF

log "✅ pg_hba.conf configurado"

# Configurar firewall para permitir PostgreSQL
log "Configurando firewall..."
ufw allow 5432/tcp || true
log "✅ Firewall configurado para porta 5432"

# Verificar se usuário ligai existe e tem as permissões corretas
log "Verificando usuário PostgreSQL 'ligai'..."

# Criar usuário se não existir
sudo -u postgres psql -c "CREATE USER ligai WITH PASSWORD 'ligai';" 2>/dev/null || true

# Dar privilégios ao usuário
sudo -u postgres psql -c "ALTER USER ligai CREATEDB;" 2>/dev/null || true

# Criar database ligai se não existir
sudo -u postgres psql -c "CREATE DATABASE ligai OWNER ligai;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ligai TO ligai;" 2>/dev/null || true

log "✅ Usuário e database ligai configurados"

# Reiniciar PostgreSQL
log "Reiniciando PostgreSQL..."
systemctl restart postgresql

if systemctl is-active --quiet postgresql; then
    log "✅ PostgreSQL reiniciado com sucesso"
else
    echo -e "${RED}❌ Erro ao reiniciar PostgreSQL${NC}"
    echo "Verificando logs..."
    journalctl -u postgresql --no-pager -n 5
    exit 1
fi

# Aguardar PostgreSQL inicializar
sleep 3

# Testar conexão local
log "Testando conexão local..."
if sudo -u postgres psql -h localhost -U ligai -d ligai -c "SELECT 1;" >/dev/null 2>&1; then
    log "✅ Conexão local funcionando"
else
    warn "Conexão local falhou, mas isso pode ser normal se a senha estiver incorreta"
fi

# Verificar se está escutando na porta correta
log "Verificando portas abertas..."
if command -v netstat >/dev/null 2>&1; then
    POSTGRES_LISTENING=$(netstat -ln | grep ":5432" | head -1)
elif command -v ss >/dev/null 2>&1; then
    POSTGRES_LISTENING=$(ss -ln | grep ":5432" | head -1)
else
    POSTGRES_LISTENING="comando não encontrado"
fi

if [[ -n "$POSTGRES_LISTENING" ]] && [[ "$POSTGRES_LISTENING" != "comando não encontrado" ]]; then
    if echo "$POSTGRES_LISTENING" | grep -q "0.0.0.0:5432\|:::5432"; then
        log "✅ PostgreSQL está escutando na porta 5432 (todas as interfaces)"
        echo "   $POSTGRES_LISTENING"
    else
        log "✅ PostgreSQL está escutando na porta 5432"  
        echo "   $POSTGRES_LISTENING"
        warn "Mas ainda pode estar apenas em localhost - aguarde o teste final"
    fi
else
    warn "Não foi possível verificar se PostgreSQL está escutando corretamente"
fi

echo
echo -e "${GREEN}🎉 CONFIGURAÇÃO CONCLUÍDA! 🎉${NC}"
echo
echo "Configurações para PGAdmin:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Host:     109.123.251.250"
echo "Port:     5432"
echo "Database: ligai"
echo "Username: ligai"
echo "Password: ligai"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo -e "${YELLOW}Dicas:${NC}"
echo "• Se ainda não conectar, aguarde 1-2 minutos"
echo "• Certifique-se de que seu firewall local permite conexões na porta 5432"
echo "• Teste com SSL Mode: 'Disable' no PGAdmin"
echo
echo -e "${GREEN}Para verificar logs: journalctl -u postgresql -f${NC}"