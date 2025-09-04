#!/bin/bash

#################################################
# LigAI Dashboard - Correção Manual PostgreSQL
# Edita diretamente os arquivos de configuração
#################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Correção Manual PostgreSQL - LigAI Dashboard${NC}"
echo "=================================================="

# Verificar se é root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}Execute como root: sudo bash fix-postgresql-manual.sh${NC}"
    exit 1
fi

echo -e "${YELLOW}🔧 Editando arquivos de configuração diretamente...${NC}"

# Arquivos de configuração PostgreSQL 12
PG_CONF="/etc/postgresql/12/main/postgresql.conf"
PG_HBA="/etc/postgresql/12/main/pg_hba.conf"

# 1. Configurar postgresql.conf
echo -e "${YELLOW}1. Configurando postgresql.conf...${NC}"

if [[ -f "$PG_CONF" ]]; then
    # Backup
    cp "$PG_CONF" "$PG_CONF.backup.$(date +%Y%m%d_%H%M%S)"
    
    # Descomentare e configurar listen_addresses
    sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" "$PG_CONF"
    sed -i "s/listen_addresses = 'localhost'/listen_addresses = '*'/" "$PG_CONF"
    
    # Adicionar no final se não existir
    if ! grep -q "^listen_addresses" "$PG_CONF"; then
        echo "" >> "$PG_CONF"
        echo "# LigAI Dashboard - Conexões externas" >> "$PG_CONF"
        echo "listen_addresses = '*'" >> "$PG_CONF"
    fi
    
    # Verificar se port está descomentado
    sed -i "s/#port = 5432/port = 5432/" "$PG_CONF"
    
    echo -e "${GREEN}✅ postgresql.conf configurado${NC}"
else
    echo -e "${RED}❌ Arquivo $PG_CONF não encontrado${NC}"
    exit 1
fi

# 2. Configurar pg_hba.conf
echo -e "${YELLOW}2. Configurando pg_hba.conf...${NC}"

if [[ -f "$PG_HBA" ]]; then
    # Backup
    cp "$PG_HBA" "$PG_HBA.backup.$(date +%Y%m%d_%H%M%S)"
    
    # Remover duplicatas do ligai se existirem
    sed -i '/host.*ligai.*ligai.*0\.0\.0\.0/d' "$PG_HBA"
    sed -i '/# LigAI Dashboard access/d' "$PG_HBA"
    
    # Adicionar regras no final
    echo "" >> "$PG_HBA"
    echo "# LigAI Dashboard access" >> "$PG_HBA"
    echo "host    ligai           ligai           0.0.0.0/0               md5" >> "$PG_HBA"
    echo "host    all             ligai           0.0.0.0/0               md5" >> "$PG_HBA"
    
    echo -e "${GREEN}✅ pg_hba.conf configurado${NC}"
else
    echo -e "${RED}❌ Arquivo $PG_HBA não encontrado${NC}"
    exit 1
fi

# 3. Criar usuário e database
echo -e "${YELLOW}3. Configurando usuário e database...${NC}"

# Criar usuário ligai se não existir
sudo -u postgres psql -c "CREATE USER ligai WITH PASSWORD 'ligai';" 2>/dev/null || true
sudo -u postgres psql -c "ALTER USER ligai CREATEDB;" 2>/dev/null || true

# Criar database ligai_db se não existir  
sudo -u postgres psql -c "CREATE DATABASE ligai_db OWNER ligai;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ligai_db TO ligai;" 2>/dev/null || true

echo -e "${GREEN}✅ Usuário e database configurados${NC}"

# 4. Reiniciar PostgreSQL
echo -e "${YELLOW}4. Reiniciando PostgreSQL...${NC}"
systemctl restart postgresql

if systemctl is-active --quiet postgresql; then
    echo -e "${GREEN}✅ PostgreSQL reiniciado com sucesso${NC}"
else
    echo -e "${RED}❌ Erro ao reiniciar PostgreSQL${NC}"
    echo "Verificando logs..."
    journalctl -u postgresql --no-pager -n 10
    exit 1
fi

# Aguardar PostgreSQL inicializar
sleep 3

# 5. Verificação final
echo -e "${YELLOW}5. Verificação final...${NC}"

# Verificar se está escutando em todas as interfaces
if command -v ss >/dev/null 2>&1; then
    LISTENING=$(ss -ln | grep ":5432")
elif command -v netstat >/dev/null 2>&1; then
    LISTENING=$(netstat -ln | grep ":5432")
else
    LISTENING=""
fi

echo "Portas em uso:"
echo "$LISTENING"

if echo "$LISTENING" | grep -q "0.0.0.0:5432\|:::5432"; then
    echo -e "${GREEN}✅ PostgreSQL está escutando em todas as interfaces!${NC}"
else
    echo -e "${YELLOW}⚠️ PostgreSQL ainda pode estar apenas em localhost${NC}"
fi

# Testar conexão com database ligai_db
echo -e "${YELLOW}6. Testando database 'ligai_db'...${NC}"
DB_TEST=$(sudo -u postgres psql -lqt | grep -w ligai_db)
if [[ -n "$DB_TEST" ]]; then
    echo -e "${GREEN}✅ Database 'ligai_db' existe e está acessível${NC}"
else
    echo -e "${RED}❌ Database 'ligai_db' não foi criado corretamente${NC}"
fi

echo
echo -e "${GREEN}🎉 CONFIGURAÇÃO CONCLUÍDA! 🎉${NC}"
echo
echo "Teste agora no PGAdmin:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Host:     109.123.251.250"
echo "Port:     5432"
echo "Database: ligai_db"
echo "Username: ligai"
echo "Password: ligai"
echo "SSL Mode: Disable"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo -e "${YELLOW}Se ainda não conectar:${NC}"
echo "• Aguarde 1-2 minutos após as mudanças"
echo "• Certifique-se de que SSL Mode está em 'Disable'"
echo "• Verifique firewall do seu computador local"
echo "• Tente com outro cliente (DBeaver, Adminer)"

# Mostrar configuração atual
echo
echo -e "${YELLOW}📋 Configurações aplicadas:${NC}"
echo "listen_addresses no postgresql.conf:"
grep "^listen_addresses" "$PG_CONF" || echo "Não encontrado"
echo
echo "Regras ligai no pg_hba.conf:"
grep "ligai" "$PG_HBA" | grep -v "^#" || echo "Não encontrado"