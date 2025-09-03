#!/bin/bash

#################################################
# LigAI Dashboard - Instalador Final v6.0
# Solução definitiva para problemas do Node.js
#################################################

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

# Configurações
LIGAI_USER="ligai"
LIGAI_DIR="/opt/ligai"
LOG_FILE="/var/log/ligai-install.log"

# Funções de log
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
    echo "[AVISO] $1" >> "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERRO]${NC} $1"
    echo "[ERRO] $1" >> "$LOG_FILE"
    exit 1
}

# Banner
echo -e "${BLUE}${BOLD}"
echo "╔═══════════════════════════════════════╗"
echo "║         LigAI Dashboard v6.0          ║"
echo "║     Instalador Definitivo Ubuntu      ║"
echo "╚═══════════════════════════════════════╝"
echo -e "${NC}"

# Verificações iniciais
if [[ $EUID -ne 0 ]]; then
    error "Execute como root: sudo bash install-ligai-final.sh"
fi

# Criar log
mkdir -p "$(dirname "$LOG_FILE")"
touch "$LOG_FILE"
log "Iniciando instalação LigAI Dashboard v6.0..."

# Instalar Node.js 20 via método alternativo mais robusto
install_nodejs_20_definitive() {
    log "=== INSTALAÇÃO DEFINITIVA NODE.JS 20 ==="
    
    # Remover TUDO relacionado ao Node.js
    log "Limpeza completa do Node.js..."
    
    # Parar processos
    pkill -f node || true
    pkill -f npm || true
    
    # Remover pacotes Ubuntu padrão primeiro
    apt remove --purge -y nodejs npm nodejs-doc node-* npm-* >> "$LOG_FILE" 2>&1 || true
    apt autoremove -y >> "$LOG_FILE" 2>&1 || true
    apt autoclean >> "$LOG_FILE" 2>&1 || true
    
    # Remover repositórios antigos
    rm -rf /etc/apt/sources.list.d/nodesource* >> "$LOG_FILE" 2>&1 || true
    rm -rf /usr/share/keyrings/nodesource* >> "$LOG_FILE" 2>&1 || true
    
    # Remover binários manualmente
    rm -rf /usr/bin/node /usr/bin/npm /usr/bin/npx >> "$LOG_FILE" 2>&1 || true
    rm -rf /usr/local/bin/node /usr/local/bin/npm /usr/local/bin/npx >> "$LOG_FILE" 2>&1 || true
    rm -rf /usr/lib/node_modules >> "$LOG_FILE" 2>&1 || true
    
    # Limpar cache
    apt update >> "$LOG_FILE" 2>&1
    
    # MÉTODO 1: Instalação via Snap (mais confiável)
    log "Método 1: Tentando instalação via Snap..."
    if command -v snap &> /dev/null; then
        # Remover snap node se existir
        snap remove node >> "$LOG_FILE" 2>&1 || true
        
        # Instalar via snap
        if snap install node --classic >> "$LOG_FILE" 2>&1; then
            # Criar links simbólicos
            ln -sf /snap/bin/node /usr/bin/node >> "$LOG_FILE" 2>&1 || true
            ln -sf /snap/bin/npm /usr/bin/npm >> "$LOG_FILE" 2>&1 || true
            ln -sf /snap/bin/npx /usr/bin/npx >> "$LOG_FILE" 2>&1 || true
            
            # Verificar versão
            sleep 3
            if [[ -f "/usr/bin/node" ]] && [[ -f "/usr/bin/npm" ]]; then
                node_ver=$(/usr/bin/node --version 2>/dev/null || echo "erro")
                npm_ver=$(/usr/bin/npm --version 2>/dev/null || echo "erro")
                
                if [[ "$node_ver" =~ ^v(1[8-9]|[2-9][0-9]) ]]; then
                    log "✅ Node.js instalado via Snap: $node_ver"
                    log "✅ NPM instalado via Snap: $npm_ver"
                    return 0
                fi
            fi
        fi
    fi
    
    # MÉTODO 2: Download direto do oficial Node.js
    log "Método 2: Download direto do Node.js oficial..."
    
    # Detectar arquitetura
    if [[ $(uname -m) == "x86_64" ]]; then
        NODE_ARCH="x64"
    elif [[ $(uname -m) == "aarch64" ]]; then
        NODE_ARCH="arm64"
    else
        NODE_ARCH="x64"
    fi
    
    # Download Node.js 20 LTS
    NODE_VERSION="v20.11.1"
    NODE_PACKAGE="node-${NODE_VERSION}-linux-${NODE_ARCH}"
    
    log "Baixando Node.js ${NODE_VERSION} para ${NODE_ARCH}..."
    
    cd /tmp
    wget -O "${NODE_PACKAGE}.tar.xz" "https://nodejs.org/dist/${NODE_VERSION}/${NODE_PACKAGE}.tar.xz" >> "$LOG_FILE" 2>&1
    
    if [[ ! -f "${NODE_PACKAGE}.tar.xz" ]]; then
        warn "Falha no download direto, tentando NodeSource..."
    else
        # Extrair
        tar -xf "${NODE_PACKAGE}.tar.xz" >> "$LOG_FILE" 2>&1
        
        if [[ -d "$NODE_PACKAGE" ]]; then
            # Copiar binários
            cp "${NODE_PACKAGE}/bin/node" /usr/bin/node >> "$LOG_FILE" 2>&1
            cp "${NODE_PACKAGE}/bin/npm" /usr/bin/npm >> "$LOG_FILE" 2>&1
            cp "${NODE_PACKAGE}/bin/npx" /usr/bin/npx >> "$LOG_FILE" 2>&1
            
            # Copiar módulos
            mkdir -p /usr/lib/node_modules >> "$LOG_FILE" 2>&1
            cp -r "${NODE_PACKAGE}/lib/node_modules/"* /usr/lib/node_modules/ >> "$LOG_FILE" 2>&1
            
            # Permissões
            chmod +x /usr/bin/node /usr/bin/npm /usr/bin/npx >> "$LOG_FILE" 2>&1
            
            # Verificar
            sleep 2
            if [[ -f "/usr/bin/node" ]] && [[ -f "/usr/bin/npm" ]]; then
                node_ver=$(/usr/bin/node --version 2>/dev/null || echo "erro")
                npm_ver=$(/usr/bin/npm --version 2>/dev/null || echo "erro")
                
                if [[ "$node_ver" =~ ^v(1[8-9]|[2-9][0-9]) ]]; then
                    log "✅ Node.js instalado via download direto: $node_ver"
                    log "✅ NPM instalado via download direto: $npm_ver"
                    
                    # Limpeza
                    rm -rf /tmp/"${NODE_PACKAGE}"* >> "$LOG_FILE" 2>&1 || true
                    return 0
                fi
            fi
        fi
        
        # Limpeza
        rm -rf /tmp/"${NODE_PACKAGE}"* >> "$LOG_FILE" 2>&1 || true
    fi
    
    # MÉTODO 3: NodeSource como último recurso
    log "Método 3: NodeSource (último recurso)..."
    
    # Garantir que repositórios Ubuntu antigos estão removidos
    sed -i '/nodesource/d' /etc/apt/sources.list >> "$LOG_FILE" 2>&1 || true
    
    # Download e configuração NodeSource
    curl -fsSL https://deb.nodesource.com/setup_20.x -o /tmp/nodesource_setup.sh >> "$LOG_FILE" 2>&1
    
    if [[ -f /tmp/nodesource_setup.sh ]]; then
        # Executar setup
        bash /tmp/nodesource_setup.sh >> "$LOG_FILE" 2>&1 || true
        
        # Forçar atualização
        apt update >> "$LOG_FILE" 2>&1
        
        # Verificar se repositório foi adicionado
        if grep -q "nodesource" /etc/apt/sources.list.d/* 2>/dev/null; then
            log "Repositório NodeSource configurado, instalando..."
            
            # Instalar especificamente do repositório NodeSource
            apt install -y nodejs >> "$LOG_FILE" 2>&1 || true
            
            # Verificar versão
            if [[ -f "/usr/bin/node" ]]; then
                node_ver=$(/usr/bin/node --version 2>/dev/null || echo "erro")
                
                if [[ "$node_ver" =~ ^v(1[8-9]|[2-9][0-9]) ]]; then
                    log "✅ Node.js via NodeSource: $node_ver"
                    
                    # Instalar NPM se não veio junto
                    if [[ ! -f "/usr/bin/npm" ]]; then
                        apt install -y npm >> "$LOG_FILE" 2>&1 || true
                    fi
                    
                    if [[ -f "/usr/bin/npm" ]]; then
                        npm_ver=$(/usr/bin/npm --version 2>/dev/null || echo "erro")
                        log "✅ NPM via NodeSource: $npm_ver"
                        rm -f /tmp/nodesource_setup.sh >> "$LOG_FILE" 2>&1 || true
                        return 0
                    fi
                fi
            fi
        fi
        
        rm -f /tmp/nodesource_setup.sh >> "$LOG_FILE" 2>&1 || true
    fi
    
    error "Todos os métodos de instalação do Node.js falharam"
}

# Função principal de instalação
main() {
    log "Atualizando sistema..."
    apt update -y >> "$LOG_FILE" 2>&1
    apt upgrade -y >> "$LOG_FILE" 2>&1
    
    log "Instalando dependências básicas..."
    apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release build-essential >> "$LOG_FILE" 2>&1
    
    # Instalar Node.js de forma definitiva
    install_nodejs_20_definitive
    
    # Configurar npm
    log "Configurando NPM..."
    /usr/bin/npm config set fund false >> "$LOG_FILE" 2>&1 || true
    /usr/bin/npm config set audit false >> "$LOG_FILE" 2>&1 || true
    
    # Verificação final
    log "Verificação final da instalação..."
    
    node_version=$(/usr/bin/node --version 2>/dev/null || echo "ERRO")
    npm_version=$(/usr/bin/npm --version 2>/dev/null || echo "ERRO")
    
    if [[ "$node_version" =~ ^v(1[8-9]|[2-9][0-9]) ]] && [[ "$npm_version" != "ERRO" ]]; then
        echo
        echo -e "${GREEN}${BOLD}✅ INSTALAÇÃO CONCLUÍDA COM SUCESSO!${NC}"
        echo
        echo "Versões instaladas:"
        echo "• Node.js: $node_version"
        echo "• NPM: $npm_version"
        echo
        echo "Agora continue com a instalação do LigAI Dashboard."
        log "✅ Node.js e NPM instalados corretamente"
    else
        error "Falha na verificação final. Node: $node_version, NPM: $npm_version"
    fi
}

# Executar instalação
main