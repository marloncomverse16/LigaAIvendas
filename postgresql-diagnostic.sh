#!/bin/bash

#################################################
# LigAI Dashboard - Diagnóstico PostgreSQL
# Verifica configurações e problemas de conexão
#################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}LigAI Dashboard - Diagnóstico PostgreSQL${NC}"
echo "================================================"
echo

# Verificar se PostgreSQL está rodando
echo -e "${YELLOW}1. Status do PostgreSQL:${NC}"
if systemctl is-active --quiet postgresql; then
    echo -e "${GREEN}✅ PostgreSQL está rodando${NC}"
else
    echo -e "${RED}❌ PostgreSQL NÃO está rodando${NC}"
    echo "Execute: sudo systemctl start postgresql"
    exit 1
fi

# Encontrar versão do PostgreSQL
PG_VERSION=""
for version in 12 13 14 15 16; do
    if [[ -d "/etc/postgresql/$version" ]]; then
        PG_VERSION=$version
        break
    fi
done

if [[ -z "$PG_VERSION" ]]; then
    echo -e "${RED}❌ Não foi possível encontrar a versão do PostgreSQL${NC}"
    exit 1
fi

echo -e "📋 Versão detectada: PostgreSQL $PG_VERSION"
echo

# Verificar se está escutando na porta
echo -e "${YELLOW}2. Portas de escuta:${NC}"
LISTENING=$(netstat -ln 2>/dev/null | grep ":5432" || ss -ln 2>/dev/null | grep ":5432")
if [[ -n "$LISTENING" ]]; then
    echo -e "${GREEN}✅ PostgreSQL escutando na porta 5432${NC}"
    echo "$LISTENING"
    
    # Verificar se está escutando em todas as interfaces
    if echo "$LISTENING" | grep -q "0.0.0.0:5432\|:::5432"; then
        echo -e "${GREEN}✅ Escutando em todas as interfaces (0.0.0.0)${NC}"
    else
        echo -e "${YELLOW}⚠️ Escutando apenas em localhost${NC}"
        echo -e "${RED}❌ PROBLEMA: PostgreSQL não aceita conexões externas${NC}"
    fi
else
    echo -e "${RED}❌ PostgreSQL NÃO está escutando na porta 5432${NC}"
fi
echo

# Verificar configuração postgresql.conf
PG_CONF="/etc/postgresql/$PG_VERSION/main/postgresql.conf"
echo -e "${YELLOW}3. Configuração postgresql.conf:${NC}"
if [[ -f "$PG_CONF" ]]; then
    echo -e "📁 Arquivo: $PG_CONF"
    
    # Verificar listen_addresses
    LISTEN_ADDR=$(grep "^listen_addresses" "$PG_CONF" || echo "não encontrado")
    echo -e "🔧 listen_addresses: $LISTEN_ADDR"
    
    if echo "$LISTEN_ADDR" | grep -q "'\\*'"; then
        echo -e "${GREEN}✅ Configurado para aceitar conexões externas${NC}"
    else
        echo -e "${RED}❌ NÃO configurado para conexões externas${NC}"
    fi
    
    # Verificar porta
    PORT_CONF=$(grep "^port" "$PG_CONF" || echo "padrão")
    echo -e "🔧 port: $PORT_CONF"
else
    echo -e "${RED}❌ Arquivo postgresql.conf não encontrado${NC}"
fi
echo

# Verificar pg_hba.conf
PG_HBA="/etc/postgresql/$PG_VERSION/main/pg_hba.conf"
echo -e "${YELLOW}4. Configuração pg_hba.conf:${NC}"
if [[ -f "$PG_HBA" ]]; then
    echo -e "📁 Arquivo: $PG_HBA"
    
    # Verificar regras para ligai
    LIGAI_RULES=$(grep "ligai" "$PG_HBA" | grep -v "^#" || echo "nenhuma")
    echo -e "🔧 Regras para usuário 'ligai':"
    if [[ "$LIGAI_RULES" != "nenhuma" ]]; then
        echo "$LIGAI_RULES" | while read line; do
            echo -e "${GREEN}   ✅ $line${NC}"
        done
    else
        echo -e "${RED}   ❌ Nenhuma regra encontrada para usuário 'ligai'${NC}"
    fi
else
    echo -e "${RED}❌ Arquivo pg_hba.conf não encontrado${NC}"
fi
echo

# Verificar firewall
echo -e "${YELLOW}5. Configuração do Firewall:${NC}"
if command -v ufw >/dev/null; then
    UFW_STATUS=$(ufw status | grep "5432" || echo "porta 5432 não encontrada")
    echo -e "🔥 UFW Status:"
    echo "$UFW_STATUS"
    
    if echo "$UFW_STATUS" | grep -q "5432.*ALLOW"; then
        echo -e "${GREEN}✅ Porta 5432 liberada no firewall${NC}"
    else
        echo -e "${RED}❌ Porta 5432 NÃO está liberada no firewall${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ UFW não encontrado${NC}"
fi
echo

# Verificar usuário PostgreSQL
echo -e "${YELLOW}6. Usuário PostgreSQL 'ligai':${NC}"
USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='ligai';" 2>/dev/null || echo "erro")
if [[ "$USER_EXISTS" == "1" ]]; then
    echo -e "${GREEN}✅ Usuário 'ligai' existe${NC}"
    
    # Verificar permissões
    USER_PERMS=$(sudo -u postgres psql -tAc "SELECT rolcreatedb, rolsuper FROM pg_roles WHERE rolname='ligai';" 2>/dev/null || echo "erro")
    echo -e "🔧 Permissões: $USER_PERMS"
else
    echo -e "${RED}❌ Usuário 'ligai' NÃO existe${NC}"
fi
echo

# Verificar database
echo -e "${YELLOW}7. Database 'ligai':${NC}"
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='ligai';" 2>/dev/null || echo "erro")
if [[ "$DB_EXISTS" == "1" ]]; then
    echo -e "${GREEN}✅ Database 'ligai' existe${NC}"
else
    echo -e "${RED}❌ Database 'ligai' NÃO existe${NC}"
fi
echo

# Teste de conexão local
echo -e "${YELLOW}8. Teste de Conexão:${NC}"
echo -e "🔧 Testando conexão local..."

# Tentar conexão sem senha (confiança)
LOCAL_TEST=$(sudo -u postgres psql -h localhost -U ligai -d ligai -c "SELECT 1;" 2>&1 || echo "falhou")
if echo "$LOCAL_TEST" | grep -q "1"; then
    echo -e "${GREEN}✅ Conexão local funcionando${NC}"
else
    echo -e "${YELLOW}⚠️ Conexão local requer senha${NC}"
    echo "$LOCAL_TEST" | head -2
fi

echo
echo -e "${GREEN}==================== RESUMO ====================${NC}"
echo

# Detectar principais problemas
PROBLEMS=0

if ! echo "$LISTENING" | grep -q "0.0.0.0:5432\|:::5432"; then
    echo -e "${RED}❌ PROBLEMA 1: PostgreSQL não aceita conexões externas${NC}"
    echo -e "   Solução: Configurar listen_addresses = '*' em postgresql.conf"
    ((PROBLEMS++))
fi

if ! grep -q "ligai" "$PG_HBA" 2>/dev/null; then
    echo -e "${RED}❌ PROBLEMA 2: Sem regras de acesso para usuário 'ligai'${NC}"
    echo -e "   Solução: Adicionar regras em pg_hba.conf"
    ((PROBLEMS++))
fi

if ! ufw status 2>/dev/null | grep -q "5432.*ALLOW"; then
    echo -e "${RED}❌ PROBLEMA 3: Firewall bloqueando porta 5432${NC}"
    echo -e "   Solução: ufw allow 5432"
    ((PROBLEMS++))
fi

if [[ "$PROBLEMS" -eq 0 ]]; then
    echo -e "${GREEN}🎉 Configuração parece estar correta!${NC}"
    echo -e "${YELLOW}Se ainda não consegue conectar:${NC}"
    echo "• Aguarde 1-2 minutos após mudanças"
    echo "• Verifique firewall do seu computador local"
    echo "• Use SSL Mode: 'Disable' no PGAdmin"
    echo "• Teste com outro cliente (DBeaver, psql)"
else
    echo -e "${RED}🔧 Execute: sudo bash configure-postgresql-external.sh${NC}"
fi

echo
echo -e "${YELLOW}Para aplicar correções automaticamente:${NC}"
echo -e "${GREEN}sudo bash configure-postgresql-external.sh${NC}"