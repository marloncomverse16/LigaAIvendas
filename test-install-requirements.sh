#!/bin/bash

#################################################
# LigAI Dashboard - Teste de Pré-requisitos
# Verifica se o sistema atende aos requisitos
#################################################

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

echo -e "${BLUE}${BOLD}LigAI Dashboard - Teste de Pré-requisitos${NC}"
echo "=========================================="
echo

# Função de teste
test_requirement() {
    local requirement="$1"
    local command="$2"
    local expected="$3"
    
    echo -n "Testando $requirement... "
    
    if eval "$command" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ OK${NC}"
        return 0
    else
        echo -e "${RED}❌ FALHA${NC}"
        if [[ -n "$expected" ]]; then
            echo "  Esperado: $expected"
        fi
        return 1
    fi
}

# Testes principais
failed_tests=0

# Sistema operacional
if test_requirement "Sistema Ubuntu/Debian" "command -v apt"; then
    echo "  Sistema: $(lsb_release -d 2>/dev/null | cut -f2 || echo 'Ubuntu/Debian')"
else
    ((failed_tests++))
fi

# Usuário root
if test_requirement "Usuário root" "[[ \$EUID -eq 0 ]]"; then
    echo "  UID: $EUID (root)"
else
    ((failed_tests++))
    echo "  Execute: sudo bash install-ligai-complete.sh"
fi

# Conectividade com internet
if test_requirement "Conexão com internet" "ping -c 1 8.8.8.8"; then
    echo "  Conectividade: OK"
else
    ((failed_tests++))
fi

# GitHub acessível
if test_requirement "Acesso ao GitHub" "curl -s --connect-timeout 10 https://github.com"; then
    echo "  GitHub: Acessível"
else
    ((failed_tests++))
fi

# Espaço em disco
available_space=$(df / | awk 'NR==2 {print $4}')
if [[ $available_space -gt 2097152 ]]; then # 2GB em KB
    echo -e "Espaço em disco... ${GREEN}✅ OK${NC}"
    echo "  Disponível: $(( available_space / 1024 / 1024 ))GB"
else
    echo -e "Espaço em disco... ${RED}❌ FALHA${NC}"
    echo "  Necessário: 2GB, Disponível: $(( available_space / 1024 / 1024 ))GB"
    ((failed_tests++))
fi

# Memória RAM
total_memory=$(free -m | awk 'NR==2{print $2}')
if [[ $total_memory -gt 512 ]]; then
    echo -e "Memória RAM... ${GREEN}✅ OK${NC}"
    echo "  Total: ${total_memory}MB"
else
    echo -e "Memória RAM... ${RED}❌ FALHA${NC}"
    echo "  Necessário: 512MB, Disponível: ${total_memory}MB"
    ((failed_tests++))
fi

echo
echo "=========================================="

if [[ $failed_tests -eq 0 ]]; then
    echo -e "${GREEN}${BOLD}✅ TODOS OS PRÉ-REQUISITOS ATENDIDOS${NC}"
    echo
    echo "Seu sistema está pronto para instalar o LigAI Dashboard!"
    echo "Execute: bash install-ligai-complete.sh"
    exit 0
else
    echo -e "${RED}${BOLD}❌ $failed_tests PRÉ-REQUISITOS FALHARAM${NC}"
    echo
    echo "Por favor, corrija os problemas acima antes de prosseguir."
    exit 1
fi