#!/bin/bash

#################################################
# LigAI Dashboard - Script de Reparo Node.js
# Corrige problemas de instalação do Node.js/NPM
#################################################

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

echo -e "${BLUE}${BOLD}LigAI Dashboard - Reparo Node.js${NC}"
echo "======================================"
echo

# Verificar se é root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}Este script deve ser executado como root${NC}"
    exit 1
fi

log() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

error() {
    echo -e "${RED}[ERRO]${NC} $1"
    exit 1
}

# Função para remover Node.js completamente
remove_nodejs() {
    log "Removendo instalações antigas do Node.js..."
    
    # Parar processos que usam node
    pkill -f node || true
    
    # Remover pacotes
    apt remove --purge -y nodejs npm nodejs-doc >> /dev/null 2>&1 || true
    apt autoremove -y >> /dev/null 2>&1 || true
    apt autoclean >> /dev/null 2>&1 || true
    
    # Remover repositórios antigos
    rm -rf /etc/apt/sources.list.d/nodesource.list* || true
    rm -rf /usr/share/keyrings/nodesource.gpg || true
    
    # Remover binários antigos
    rm -rf /usr/bin/node /usr/bin/npm /usr/bin/npx || true
    rm -rf /usr/local/bin/node /usr/local/bin/npm /usr/local/bin/npx || true
    
    log "Limpeza concluída"
}

# Função para instalar Node.js 20
install_nodejs_20() {
    log "Instalando Node.js 20..."
    
    # Tentar primeiro via snap (mais confiável)
    log "Tentativa 1: Instalação via snap..."
    if snap install node --classic >> /dev/null 2>&1; then
        # Criar links simbólicos
        ln -sf /snap/bin/node /usr/bin/node 2>/dev/null || true
        ln -sf /snap/bin/npm /usr/bin/npm 2>/dev/null || true
        
        # Verificar se funcionou
        if command -v node &> /dev/null && command -v npm &> /dev/null; then
            log "✅ Node.js instalado via snap"
            return 0
        fi
    fi
    
    log "Tentativa 2: Instalação via NodeSource..."
    # Atualizar sistema
    apt update -y >> /dev/null 2>&1
    
    # Baixar e executar script do NodeSource
    curl -fsSL https://deb.nodesource.com/setup_20.x -o /tmp/nodesource_setup.sh
    
    if [[ ! -f /tmp/nodesource_setup.sh ]]; then
        error "Falha ao baixar script de instalação"
    fi
    
    # Executar configuração
    bash /tmp/nodesource_setup.sh >> /dev/null 2>&1 || error "Falha na configuração do repositório"
    
    # Atualizar e instalar
    apt update -y >> /dev/null 2>&1
    apt install -y nodejs >> /dev/null 2>&1
    
    # Se NPM não veio junto, instalar separadamente
    if [[ ! -f "/usr/bin/npm" ]] && [[ -f "/usr/bin/node" ]]; then
        log "NPM não incluído, instalando separadamente..."
        apt install -y npm >> /dev/null 2>&1 || {
            # Instalar NPM manualmente se apt falhar
            log "Instalando NPM manualmente..."
            curl -L https://registry.npmjs.org/npm/-/npm-10.2.4.tgz | tar xz -C /tmp
            mkdir -p /usr/lib/node_modules
            mv /tmp/package /usr/lib/node_modules/npm
            
            # Criar wrapper
            cat > /usr/bin/npm << 'EOF'
#!/bin/bash
exec /usr/bin/node /usr/lib/node_modules/npm/bin/npm-cli.js "$@"
EOF
            chmod +x /usr/bin/npm
        }
    fi
    
    # Limpar arquivo temporário
    rm -f /tmp/nodesource_setup.sh
    
    log "Node.js instalado via NodeSource"
}

# Função para verificar instalação
verify_installation() {
    log "Verificando instalação..."
    
    # Atualizar PATH
    export PATH="/usr/bin:/usr/local/bin:$PATH"
    hash -r
    sleep 2
    
    # Verificar comandos
    if ! command -v node &> /dev/null; then
        error "Node.js não encontrado"
    fi
    
    if ! command -v npm &> /dev/null; then
        error "NPM não encontrado"
    fi
    
    # Verificar versões
    node_version=$(node --version 2>/dev/null)
    npm_version=$(npm --version 2>/dev/null)
    
    if [[ ! "$node_version" =~ ^v2[0-9] ]]; then
        error "Versão incorreta do Node.js: $node_version (esperado v20.x)"
    fi
    
    log "✅ Node.js $node_version instalado corretamente"
    log "✅ NPM $npm_version instalado corretamente"
    
    # Configurar npm
    npm config set fund false 2>/dev/null || true
    npm config set audit false 2>/dev/null || true
    
    log "✅ NPM configurado"
}

# Função principal
main() {
    log "Iniciando reparo do Node.js..."
    
    remove_nodejs
    install_nodejs_20
    verify_installation
    
    echo
    echo -e "${GREEN}${BOLD}✅ Node.js reparado com sucesso!${NC}"
    echo
    echo "Versões instaladas:"
    echo "• Node.js: $(node --version)"
    echo "• NPM: $(npm --version)"
    echo
    echo "Agora você pode continuar com a instalação do LigAI Dashboard."
}

# Executar
main