#!/bin/bash

# Teste rápido de instalação do Node.js 20

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Testando instalação do Node.js 20...${NC}"
echo

# Verificar se é root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}Execute como root: sudo bash test-nodejs-only.sh${NC}"
    exit 1
fi

# Remover versões antigas
echo "1. Removendo versões antigas..."
apt remove --purge -y nodejs npm nodejs-doc 2>/dev/null || true
apt autoremove -y 2>/dev/null || true

# Limpar cache
rm -rf /etc/apt/sources.list.d/nodesource.list* 2>/dev/null || true
rm -rf /usr/share/keyrings/nodesource.gpg 2>/dev/null || true

# Atualizar
echo "2. Atualizando repositórios..."
apt update -y >/dev/null 2>&1

# Instalar Node.js 20
echo "3. Instalando Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x -o /tmp/nodesource_setup.sh
bash /tmp/nodesource_setup.sh >/dev/null 2>&1
apt update -y >/dev/null 2>&1
apt install -y nodejs >/dev/null 2>&1

# Verificar
echo "4. Verificando instalação..."
sleep 3

if [[ -f "/usr/bin/node" ]] && [[ -f "/usr/bin/npm" ]]; then
    if /usr/bin/node --version >/dev/null 2>&1 && /usr/bin/npm --version >/dev/null 2>&1; then
        node_ver=$(/usr/bin/node --version)
        npm_ver=$(/usr/bin/npm --version)
        
        echo -e "${GREEN}✅ Node.js: $node_ver${NC}"
        echo -e "${GREEN}✅ NPM: $npm_ver${NC}"
        
        if [[ "$node_ver" =~ ^v2[0-9] ]]; then
            echo -e "${GREEN}✅ Versão correta instalada!${NC}"
            echo
            echo "Agora você pode executar:"
            echo "sudo bash install-ligai-complete.sh"
        else
            echo -e "${RED}❌ Versão incorreta: $node_ver${NC}"
        fi
    else
        echo -e "${RED}❌ Binários não executáveis${NC}"
    fi
else
    echo -e "${RED}❌ Binários não encontrados em /usr/bin/${NC}"
fi

# Limpeza
rm -f /tmp/nodesource_setup.sh