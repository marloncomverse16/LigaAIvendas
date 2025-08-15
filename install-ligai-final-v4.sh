#!/bin/bash

# LigAI Dashboard VPS Installer v4.0 Final
# Instalação automática com download do GitHub corrigido
# Autor: LigAI Team
# Data: 15/08/2025

set -e  # Parar em caso de erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variáveis globais
APP_NAME="ligai-dashboard"
APP_DISPLAY_NAME="LigAI Dashboard v4.0"
APP_DIRECTORY="/opt/ligai"
APP_USER="ligai"
SCRIPT_VERSION="4.0.0"

# Funções de logging
log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] ✅ $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠️  $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ❌ $1${NC}"
}

question() {
    echo -e "${BLUE}❓ $1${NC}"
}

info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Banner de apresentação
show_banner() {
    clear
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    🚀 LigAI Dashboard v4.0                   ║"
    echo "║              Instalador Automático para VPS                 ║"
    echo "║                                                              ║"
    echo "║  ✅ Download automático do GitHub                            ║"
    echo "║  ✅ PostgreSQL com detecção inteligente                      ║"
    echo "║  ✅ Nginx com SSL automático                                 ║"
    echo "║  ✅ Systemd para gerenciamento de serviços                   ║"
    echo "║  ✅ Fallback inteligente                                     ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
}

# Verificar requisitos
check_requirements() {
    log "Verificando requisitos do sistema..."
    
    # Verificar se é root
    if [[ $EUID -ne 0 ]]; then
        error "Este script precisa ser executado como root (use sudo)"
        exit 1
    fi
    
    # Verificar distribuição
    if ! command -v apt &> /dev/null; then
        error "Este script é apenas para sistemas Ubuntu/Debian"
        exit 1
    fi
    
    # Verificar espaço em disco (mínimo 2GB)
    AVAILABLE_SPACE=$(df / | awk 'NR==2 {print $4}')
    if [[ $AVAILABLE_SPACE -lt 2097152 ]]; then
        warn "Espaço em disco baixo. Recomendado: 2GB+"
    fi
    
    success "Requisitos verificados!"
}

# Coletar informações do usuário
collect_user_input() {
    log "Coletando configurações do usuário..."
    echo ""
    
    # Domínio
    question "Digite o domínio para acesso (ex: meusite.com):"
    read -r DOMAIN
    if [[ -z "$DOMAIN" ]]; then
        error "Domínio é obrigatório!"
        exit 1
    fi
    
    # Porta da aplicação
    question "Porta da aplicação [3000]:"
    read -r APP_PORT
    APP_PORT=${APP_PORT:-3000}
    
    # Configurações de banco
    echo ""
    info "Configurações do PostgreSQL:"
    question "Nome do banco de dados [ligai_db]:"
    read -r DB_NAME
    DB_NAME=${DB_NAME:-ligai_db}
    
    question "Usuário do banco [ligai_user]:"
    read -r DB_USER
    DB_USER=${DB_USER:-ligai_user}
    
    question "Senha do banco [$(openssl rand -base64 12)]:"
    read -s DB_PASSWORD
    if [[ -z "$DB_PASSWORD" ]]; then
        DB_PASSWORD=$(openssl rand -base64 12)
    fi
    echo ""
    
    # Diretório de instalação
    question "Diretório de instalação [${APP_DIRECTORY}]:"
    read -r INSTALL_DIR
    if [[ -n "$INSTALL_DIR" ]]; then
        APP_DIRECTORY="$INSTALL_DIR"
    fi
    
    # SSL
    question "Configurar SSL com Let's Encrypt? (s/N):"
    read -r SETUP_SSL
    
    # Resumo
    echo ""
    info "Resumo da instalação:"
    echo "  🌐 Domínio: ${DOMAIN}"
    echo "  🔌 Porta: ${APP_PORT}"
    echo "  💾 Banco: ${DB_NAME}"
    echo "  👤 Usuário DB: ${DB_USER}"
    echo "  📁 Diretório: ${APP_DIRECTORY}"
    echo "  🔒 SSL: $(if [[ "$SETUP_SSL" =~ ^[Ss]$ ]]; then echo "Sim"; else echo "Não"; fi)"
    echo ""
    
    question "Continuar com a instalação? (s/N):"
    read -r CONFIRM
    if [[ ! "$CONFIRM" =~ ^[Ss]$ ]]; then
        error "Instalação cancelada pelo usuário"
        exit 1
    fi
    
    success "Configurações coletadas!"
}

# Atualizar sistema
update_system() {
    log "Atualizando sistema..."
    
    export DEBIAN_FRONTEND=noninteractive
    apt update -y
    apt upgrade -y
    apt install -y \
        curl \
        wget \
        git \
        unzip \
        zip \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release \
        build-essential \
        python3 \
        python3-pip \
        lsof \
        psmisc \
        vim \
        openssl \
        net-tools
    
    success "Sistema atualizado!"
}

# Instalar Node.js
install_nodejs() {
    log "Instalando Node.js..."
    
    # Remover instalações antigas
    apt remove -y nodejs npm 2>/dev/null || true
    rm -rf /usr/local/bin/npm /usr/local/share/man/man1/node* ~/.npm
    rm -rf /usr/local/lib/node*
    rm -rf /usr/local/bin/node*
    rm -rf /usr/local/include/node*
    
    # Instalar Node.js 20
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
    
    # Verificar instalação
    NODE_VERSION_INSTALLED=$(node --version 2>/dev/null || echo "Erro")
    NPM_VERSION_INSTALLED=$(npm --version 2>/dev/null || echo "Erro")
    
    if [[ "$NODE_VERSION_INSTALLED" == "Erro" ]] || [[ "$NPM_VERSION_INSTALLED" == "Erro" ]]; then
        error "Falha na instalação do Node.js"
        exit 1
    fi
    
    log "Node.js instalado: ${NODE_VERSION_INSTALLED}"
    log "npm instalado: ${NPM_VERSION_INSTALLED}"
    
    success "Node.js configurado!"
}

# Instalar PostgreSQL de forma simplificada
install_postgresql() {
    log "Instalando PostgreSQL..."
    
    # Instalar PostgreSQL
    export DEBIAN_FRONTEND=noninteractive
    apt install -y postgresql postgresql-contrib
    
    # Iniciar serviços
    systemctl start postgresql
    systemctl enable postgresql
    
    # Aguardar inicialização
    sleep 10
    
    # Configurar banco de forma simples
    log "Configurando banco de dados..."
    
    # Criar usuário e banco
    su - postgres -c "psql -c \"DROP USER IF EXISTS ${DB_USER};\"" 2>/dev/null || true
    su - postgres -c "psql -c \"CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';\"" 2>/dev/null || true
    su - postgres -c "psql -c \"DROP DATABASE IF EXISTS ${DB_NAME};\"" 2>/dev/null || true
    su - postgres -c "psql -c \"CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};\"" 2>/dev/null || true
    su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};\"" 2>/dev/null || true
    su - postgres -c "psql -c \"ALTER USER ${DB_USER} CREATEDB;\"" 2>/dev/null || true
    
    # Configurar acesso
    PG_VERSION=$(ls /etc/postgresql/ | head -n1)
    PG_HBA_FILE="/etc/postgresql/${PG_VERSION}/main/pg_hba.conf"
    
    if [[ -f "$PG_HBA_FILE" ]]; then
        cp "$PG_HBA_FILE" "$PG_HBA_FILE.backup.$(date +%Y%m%d_%H%M%S)"
        echo "local   ${DB_NAME}   ${DB_USER}   md5" >> "$PG_HBA_FILE"
        systemctl restart postgresql
        sleep 5
    fi
    
    # Teste rápido
    if timeout 10s bash -c "PGPASSWORD='${DB_PASSWORD}' psql -h localhost -U '${DB_USER}' -d '${DB_NAME}' -c 'SELECT 1;'" &>/dev/null; then
        success "PostgreSQL configurado!"
    else
        warn "PostgreSQL pode ter problemas, mas continuando..."
    fi
}

# Instalar Nginx
install_nginx() {
    log "Instalando Nginx..."
    
    apt install -y nginx
    systemctl stop nginx 2>/dev/null || true
    
    # Liberar porta 80
    fuser -k 80/tcp 2>/dev/null || true
    sleep 2
    
    # Configuração básica
    cat > /etc/nginx/sites-available/ligai << EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    
    location / {
        proxy_pass http://localhost:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
    
    # Ativar site
    rm -f /etc/nginx/sites-enabled/default
    ln -sf /etc/nginx/sites-available/ligai /etc/nginx/sites-enabled/
    
    # Testar e iniciar
    if nginx -t; then
        systemctl start nginx
        systemctl enable nginx
        success "Nginx configurado!"
    else
        error "Erro na configuração do Nginx"
        exit 1
    fi
}

# Criar usuário da aplicação
create_app_user() {
    log "Criando usuário da aplicação..."
    
    if ! id "$APP_USER" &>/dev/null; then
        useradd -r -s /bin/bash -d "$APP_DIRECTORY" -m "$APP_USER"
    fi
    
    # Criar diretórios
    mkdir -p "$APP_DIRECTORY"
    chown -R "$APP_USER:$APP_USER" "$APP_DIRECTORY"
    
    success "Usuário ${APP_USER} criado!"
}

# Baixar e configurar aplicação
create_application() {
    log "Baixando ${APP_DISPLAY_NAME}..."
    
    # Ir para diretório
    cd "$APP_DIRECTORY"
    
    # Tentar baixar do GitHub
    if git clone https://github.com/marloncomverse16/LigaAIvendas.git temp_ligai 2>/dev/null; then
        log "Clone via Git bem-sucedido!"
        cp -r temp_ligai/* .
        cp -r temp_ligai/.* . 2>/dev/null || true
        rm -rf temp_ligai
    elif curl -L --connect-timeout 10 https://github.com/marloncomverse16/LigaAIvendas/archive/refs/heads/main.zip -o ligai.zip 2>/dev/null && unzip -q ligai.zip 2>/dev/null; then
        log "Download via ZIP bem-sucedido!"
        cp -r LigaAIvendas-main/* .
        cp -r LigaAIvendas-main/.* . 2>/dev/null || true
        rm -rf LigaAIvendas-main ligai.zip
    else
        warn "GitHub não acessível. Criando aplicação básica..."
        create_fallback_app
    fi
    
    # Configurar variáveis de ambiente
    cat > .env << EOF
NODE_ENV=production
PORT=${APP_PORT}
DOMAIN=${DOMAIN}
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}
EOF
    
    # Ajustar permissões
    chown -R "$APP_USER:$APP_USER" "$APP_DIRECTORY"
    
    success "Aplicação configurada!"
}

# Criar aplicação básica de fallback
create_fallback_app() {
    # Criar package.json básico
    cat > package.json << EOF
{
  "name": "ligai-dashboard",
  "version": "4.0.0",
  "scripts": {
    "start": "node server/index.js",
    "dev": "tsx server/index.ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "tsx": "^4.0.0"
  }
}
EOF
    
    # Criar estrutura
    mkdir -p server
    
    # Servidor básico
    cat > server/index.ts << 'EOF'
import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>LigAI Dashboard</title></head>
      <body style="font-family: Arial; text-align: center; padding: 50px;">
        <h1>🚀 LigAI Dashboard Instalado</h1>
        <p>Aplicação básica funcionando!</p>
        <p>Para obter a versão completa, execute:</p>
        <code>git clone https://github.com/marloncomverse16/LigaAIvendas.git</code>
      </body>
    </html>
  `);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(\`LigAI Dashboard rodando na porta \${PORT}\`);
});
EOF
}

# Instalar dependências
install_dependencies() {
    log "Instalando dependências..."
    
    cd "$APP_DIRECTORY"
    
    # Instalar como usuário da aplicação
    su - "$APP_USER" -c "cd '$APP_DIRECTORY' && npm install --production"
    
    # Build se existir
    if [[ -f "package.json" ]] && grep -q '"build"' package.json; then
        log "Fazendo build da aplicação..."
        su - "$APP_USER" -c "cd '$APP_DIRECTORY' && npm run build" 2>/dev/null || true
    fi
    
    success "Dependências instaladas!"
}

# Configurar systemd
setup_systemd() {
    log "Configurando serviços systemd..."
    
    cat > "/etc/systemd/system/${APP_NAME}.service" << EOF
[Unit]
Description=${APP_DISPLAY_NAME}
After=network.target postgresql.service

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIRECTORY}
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=${APP_PORT}

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable "$APP_NAME"
    
    success "Systemd configurado!"
}

# Configurar SSL
setup_ssl() {
    if [[ "$SETUP_SSL" =~ ^[Ss]$ ]]; then
        log "Configurando SSL..."
        
        # Instalar certbot
        apt install -y certbot python3-certbot-nginx
        
        # Obter certificado
        if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "admin@${DOMAIN}" --redirect; then
            success "SSL configurado!"
        else
            warn "Falha na configuração do SSL"
        fi
    fi
}

# Iniciar serviços
start_services() {
    log "Iniciando serviços..."
    
    systemctl start "$APP_NAME"
    systemctl restart nginx
    
    sleep 5
    
    if systemctl is-active --quiet "$APP_NAME"; then
        success "Serviços iniciados!"
    else
        warn "Serviço pode ter problemas. Verificando logs..."
        journalctl -u "$APP_NAME" -n 10 --no-pager
    fi
}

# Verificar instalação
verify_installation() {
    log "Verificando instalação..."
    
    # Verificar serviços
    if systemctl is-active --quiet "$APP_NAME" && systemctl is-active --quiet nginx; then
        success "Todos os serviços estão rodando!"
        return 0
    else
        error "Alguns serviços não estão funcionando"
        return 1
    fi
}

# Informações finais
show_final_info() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║               🎉 INSTALAÇÃO CONCLUÍDA COM SUCESSO!           ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
    echo "🌐 Acesse sua aplicação:"
    if [[ "$SETUP_SSL" =~ ^[Ss]$ ]]; then
        echo "   https://${DOMAIN}"
    else
        echo "   http://${DOMAIN}"
    fi
    echo ""
    echo "📋 Informações importantes:"
    echo "   • Aplicação: ${APP_DIRECTORY}"
    echo "   • Usuário: ${APP_USER}"
    echo "   • Porta: ${APP_PORT}"
    echo "   • Banco: ${DB_NAME}"
    echo ""
    echo "🔧 Comandos úteis:"
    echo "   • Status: sudo systemctl status ${APP_NAME}"
    echo "   • Reiniciar: sudo systemctl restart ${APP_NAME}"
    echo "   • Logs: sudo journalctl -u ${APP_NAME} -f"
    echo ""
    success "${APP_DISPLAY_NAME} instalado e funcionando!"
}

# Função principal
main() {
    show_banner
    check_requirements
    collect_user_input
    update_system
    install_nodejs
    install_postgresql
    install_nginx
    create_app_user
    create_application
    install_dependencies
    setup_systemd
    setup_ssl
    start_services
    
    if verify_installation; then
        show_final_info
    else
        error "Falha na verificação da instalação!"
        echo ""
        warn "Para debugar:"
        echo "sudo journalctl -u ${APP_NAME} -n 50"
        echo "sudo systemctl status ${APP_NAME}"
        exit 1
    fi
}

# Trap para limpeza em caso de erro
trap 'error "Instalação interrompida"; exit 1' INT TERM

# Executar instalação
main "$@"