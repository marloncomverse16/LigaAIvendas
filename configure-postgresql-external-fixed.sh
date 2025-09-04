#!/bin/bash

#################################################
# LigAI Dashboard - Configuração PostgreSQL Externo
# VERSÃO CORRIGIDA - Detecta pastas reais
#################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Configurando PostgreSQL para Acesso Externo${NC}"
echo "=================================================="

# Verificar se é root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}Execute como root: sudo bash configure-postgresql-external-fixed.sh${NC}"
    exit 1
fi

log() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

# Encontrar a versão real do PostgreSQL analisando as pastas
log "Detectando versão do PostgreSQL..."

# Listar pastas disponíveis em /etc/postgresql/
if [[ -d "/etc/postgresql" ]]; then
    AVAILABLE_VERSIONS=$(ls /etc/postgresql/ 2>/dev/null)
    log "Pastas encontradas em /etc/postgresql/: $AVAILABLE_VERSIONS"
    
    # Pegar a primeira versão disponível
    for version in $AVAILABLE_VERSIONS; do
        if [[ -d "/etc/postgresql/$version/main" ]]; then
            PG_VERSION="$version"
            break
        fi
    done
fi

if [[ -z "$PG_VERSION" ]]; then
    echo -e "${RED}❌ Não foi possível encontrar PostgreSQL instalado${NC}"
    echo "Estrutura de diretórios:"
    ls -la /etc/postgresql/ 2>/dev/null || echo "Pasta /etc/postgresql não existe"
    exit 1
fi

log "✅ PostgreSQL versão detectada: $PG_VERSION"

PG_CONF="/etc/postgresql/$PG_VERSION/main/postgresql.conf"
PG_HBA="/etc/postgresql/$PG_VERSION/main/pg_hba.conf"

log "Arquivos de configuração:"
log "  - postgresql.conf: $PG_CONF"
log "  - pg_hba.conf: $PG_HBA"

# Verificar se os arquivos existem
if [[ ! -f "$PG_CONF" ]]; then
    echo -e "${RED}❌ Arquivo não encontrado: $PG_CONF${NC}"
    exit 1
fi

if [[ ! -f "$PG_HBA" ]]; then
    echo -e "${RED}❌ Arquivo não encontrado: $PG_HBA${NC}"
    exit 1
fi

# Backup dos arquivos originais
log "Fazendo backup dos arquivos de configuração..."
cp "$PG_CONF" "$PG_CONF.backup.$(date +%Y%m%d_%H%M%S)" 2>/dev/null
cp "$PG_HBA" "$PG_HBA.backup.$(date +%Y%m%d_%H%M%S)" 2>/dev/null
log "✅ Backup criado"

# Configurar postgresql.conf para aceitar conexões externas
log "Configurando postgresql.conf..."

# Verificar configuração atual
CURRENT_LISTEN=$(grep "^listen_addresses" "$PG_CONF" 2>/dev/null || echo "")
CURRENT_PORT=$(grep "^port" "$PG_CONF" 2>/dev/null || echo "")

log "Configuração atual:"
log "  - listen_addresses: ${CURRENT_LISTEN:-'(comentado)'}"
log "  - port: ${CURRENT_PORT:-'(comentado)'}"

# Configurar listen_addresses
if grep -q "^listen_addresses" "$PG_CONF"; then
    sed -i "s/^listen_addresses.*/listen_addresses = '*'/" "$PG_CONF"
    log "✅ listen_addresses atualizado"
else
    echo "listen_addresses = '*'" >> "$PG_CONF"
    log "✅ listen_addresses adicionado"
fi

# Configurar port
if grep -q "^port" "$PG_CONF"; then
    sed -i "s/^port.*/port = 5432/" "$PG_CONF"
    log "✅ port atualizado"
else
    echo "port = 5432" >> "$PG_CONF"
    log "✅ port adicionado"
fi

# Configurar pg_hba.conf para permitir conexões MD5
log "Configurando pg_hba.conf..."

# Mostrar configuração atual
log "Configuração atual do pg_hba.conf:"
grep -E "^host|^local" "$PG_HBA" | head -5

# Remover linhas anteriores do ligai se existirem
sed -i '/# LigAI Dashboard access/d' "$PG_HBA"
sed -i '/host.*ligai.*ligai/d' "$PG_HBA"

# Adicionar regras de acesso
cat >> "$PG_HBA" << 'EOF'

# LigAI Dashboard access
host    ligai_db        ligai           0.0.0.0/0               md5
host    all             ligai           0.0.0.0/0               md5
EOF

log "✅ pg_hba.conf configurado"

# Configurar firewall para permitir PostgreSQL
log "Configurando firewall..."
ufw allow 5432/tcp 2>/dev/null || true
log "✅ Firewall configurado para porta 5432"

# Verificar se usuário ligai existe e tem as permissões corretas
log "Configurando usuário PostgreSQL 'ligai'..."

# Executar comandos SQL um por vez para melhor debug
sudo -u postgres psql -c "CREATE USER ligai WITH PASSWORD 'ligai';" 2>/dev/null || log "Usuário ligai já existe"
sudo -u postgres psql -c "ALTER USER ligai CREATEDB;" 2>/dev/null
sudo -u postgres psql -c "ALTER USER ligai WITH SUPERUSER;" 2>/dev/null
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ligai_db TO ligai;" 2>/dev/null

log "✅ Usuário ligai configurado com privilégios"

# Reiniciar PostgreSQL
log "Reiniciando PostgreSQL..."
systemctl restart postgresql

sleep 3

if systemctl is-active --quiet postgresql; then
    log "✅ PostgreSQL reiniciado com sucesso"
else
    echo -e "${RED}❌ Erro ao reiniciar PostgreSQL${NC}"
    echo "Verificando logs..."
    journalctl -u postgresql --no-pager -n 10
    exit 1
fi

# Aguardar PostgreSQL inicializar
sleep 5

# Verificar se está escutando na porta correta
log "Verificando conexões de rede..."

# Usar ss em vez de netstat (mais moderno)
if command -v ss >/dev/null 2>&1; then
    POSTGRES_LISTENING=$(ss -tlnp | grep ":5432")
    if [[ -n "$POSTGRES_LISTENING" ]]; then
        log "✅ PostgreSQL está escutando na porta 5432"
        echo "   $POSTGRES_LISTENING"
    else
        warn "PostgreSQL pode não estar escutando na porta 5432"
    fi
elif command -v netstat >/dev/null 2>&1; then
    POSTGRES_LISTENING=$(netstat -tlnp | grep ":5432")
    if [[ -n "$POSTGRES_LISTENING" ]]; then
        log "✅ PostgreSQL está escutando na porta 5432"
        echo "   $POSTGRES_LISTENING"
    else
        warn "PostgreSQL pode não estar escutando na porta 5432"
    fi
else
    warn "Comando ss/netstat não disponível - instalando net-tools..."
    apt-get update >/dev/null 2>&1
    apt-get install -y net-tools >/dev/null 2>&1
fi

# Testar conexão local
log "Testando conexão local..."
export PGPASSWORD='ligai'
if psql -h localhost -U ligai -d ligai_db -c "SELECT 1;" >/dev/null 2>&1; then
    log "✅ Conexão local funcionando perfeitamente"
else
    warn "Testando conexão com o banco ligai_db..."
    # Tentar conectar mostrando erro
    psql -h localhost -U ligai -d ligai_db -c "SELECT 1;" 2>&1 | head -3
fi

echo
echo -e "${GREEN}🎉 CONFIGURAÇÃO CONCLUÍDA! 🎉${NC}"
echo
echo "Configurações para PGAdmin:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Host:     109.123.251.250"
echo "Port:     5432"
echo "Database: ligai_db"
echo "Username: ligai"
echo "Password: ligai"
echo "SSL Mode: Disable"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo -e "${YELLOW}📋 Resumo da configuração:${NC}"
echo "• Versão PostgreSQL: $PG_VERSION"
echo "• Arquivos de config: /etc/postgresql/$PG_VERSION/main/"
echo "• Listen: todas as interfaces (*)"
echo "• Porta: 5432"
echo "• Firewall: liberado"
echo "• Usuário: ligai (com SUPERUSER)"
echo
echo -e "${GREEN}✅ Agora você pode conectar externamente ao PostgreSQL!${NC}"