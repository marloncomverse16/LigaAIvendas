#!/bin/bash

#################################################
# LigAI Dashboard - Script de Diagnóstico
# Diagnóstica problemas comuns na instalação
#################################################

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

# Configurações
LIGAI_DIR="/opt/ligai"
SERVICE_NAME="ligai-dashboard"
LOG_FILE="/var/log/ligai-install.log"

echo -e "${BLUE}${BOLD}LigAI Dashboard - Diagnóstico do Sistema${NC}"
echo "=========================================="
echo

# Função de teste
check_status() {
    local service="$1"
    local description="$2"
    
    echo -n "$description... "
    
    if systemctl is-active --quiet "$service"; then
        echo -e "${GREEN}✅ ATIVO${NC}"
        return 0
    else
        echo -e "${RED}❌ INATIVO${NC}"
        return 1
    fi
}

# Função de teste de comando
check_command() {
    local cmd="$1"
    local description="$2"
    
    echo -n "$description... "
    
    if command -v "$cmd" &> /dev/null; then
        local version=$($cmd --version 2>/dev/null | head -1)
        echo -e "${GREEN}✅ OK${NC} ($version)"
        return 0
    else
        echo -e "${RED}❌ NÃO ENCONTRADO${NC}"
        return 1
    fi
}

# Verificação de serviços
echo -e "${BOLD}1. Serviços do Sistema:${NC}"
check_status "$SERVICE_NAME" "LigAI Dashboard"
check_status "nginx" "Nginx"
check_status "postgresql" "PostgreSQL"
echo

# Verificação de comandos
echo -e "${BOLD}2. Comandos Essenciais:${NC}"
check_command "node" "Node.js"
check_command "npm" "NPM"
check_command "psql" "PostgreSQL Client"
echo

# Verificação de diretórios e arquivos
echo -e "${BOLD}3. Estrutura de Arquivos:${NC}"

echo -n "Diretório da aplicação... "
if [[ -d "$LIGAI_DIR" ]]; then
    echo -e "${GREEN}✅ EXISTE${NC}"
else
    echo -e "${RED}❌ NÃO EXISTE${NC}"
fi

echo -n "Arquivo package.json... "
if [[ -f "$LIGAI_DIR/package.json" ]]; then
    echo -e "${GREEN}✅ EXISTE${NC}"
else
    echo -e "${RED}❌ NÃO EXISTE${NC}"
fi

echo -n "Arquivo .env... "
if [[ -f "$LIGAI_DIR/.env" ]]; then
    echo -e "${GREEN}✅ EXISTE${NC}"
else
    echo -e "${RED}❌ NÃO EXISTE${NC}"
fi

echo -n "Diretório dist (build)... "
if [[ -d "$LIGAI_DIR/dist" ]]; then
    echo -e "${GREEN}✅ EXISTE${NC}"
else
    echo -e "${YELLOW}⚠️ NÃO EXISTE${NC}"
fi

echo

# Verificação de conectividade
echo -e "${BOLD}4. Conectividade:${NC}"

echo -n "Aplicação na porta 5000... "
if curl -s -o /dev/null -w "%{http_code}" http://localhost:5000 | grep -q "200\|302"; then
    echo -e "${GREEN}✅ RESPONDENDO${NC}"
else
    echo -e "${RED}❌ SEM RESPOSTA${NC}"
fi

echo -n "GitHub acessível... "
if curl -s --connect-timeout 10 https://github.com >/dev/null; then
    echo -e "${GREEN}✅ ACESSÍVEL${NC}"
else
    echo -e "${RED}❌ INACESSÍVEL${NC}"
fi

echo

# Verificação de logs
echo -e "${BOLD}5. Logs do Sistema:${NC}"

echo -n "Log de instalação... "
if [[ -f "$LOG_FILE" ]]; then
    echo -e "${GREEN}✅ EXISTE${NC}"
    echo "  Últimas 5 linhas:"
    tail -5 "$LOG_FILE" | sed 's/^/  /'
else
    echo -e "${YELLOW}⚠️ NÃO EXISTE${NC}"
fi

echo

# Verificação do banco de dados
echo -e "${BOLD}6. Banco de Dados:${NC}"

echo -n "PostgreSQL conectável... "
if sudo -u postgres psql -c "SELECT 1;" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${RED}❌ ERRO DE CONEXÃO${NC}"
fi

echo -n "Banco ligai_db existe... "
if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw ligai_db; then
    echo -e "${GREEN}✅ EXISTE${NC}"
else
    echo -e "${RED}❌ NÃO EXISTE${NC}"
fi

echo

# Logs de serviço se houver problemas
if ! systemctl is-active --quiet "$SERVICE_NAME"; then
    echo -e "${BOLD}7. Logs do Serviço LigAI (Últimas 20 linhas):${NC}"
    journalctl -u "$SERVICE_NAME" -n 20 --no-pager
    echo
fi

# Sugestões de correção
echo -e "${BOLD}8. Ações Sugeridas:${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}• Reinstalar Node.js: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash - && sudo apt install -y nodejs${NC}"
fi

if ! systemctl is-active --quiet "$SERVICE_NAME"; then
    echo -e "${YELLOW}• Reiniciar serviço LigAI: sudo systemctl restart $SERVICE_NAME${NC}"
fi

if ! systemctl is-active --quiet "nginx"; then
    echo -e "${YELLOW}• Reiniciar Nginx: sudo systemctl restart nginx${NC}"
fi

if [[ ! -d "$LIGAI_DIR/dist" ]]; then
    echo -e "${YELLOW}• Executar build: cd $LIGAI_DIR && sudo -u ligai npm run build${NC}"
fi

echo
echo "=========================================="
echo -e "${BLUE}Para mais informações, consulte:${NC}"
echo "• Log de instalação: $LOG_FILE"
echo "• Logs do serviço: journalctl -u $SERVICE_NAME -f"
echo "• Status dos serviços: systemctl status $SERVICE_NAME nginx postgresql"