#!/bin/bash

# LigAI Dashboard VPS Installer v4.1 (Robust Version)
# Instalação automática com correções de Nginx, segurança e robustez.
# Autor: LigAI Team & Manus AI
# Data: 15/08/2025

set -e # Parar em caso de erro
set -o pipefail # Falhar se um comando em um pipe falhar

# --- Cores e Funções de Logging ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() { echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}[$(date +'%H:%M:%S')] ✅ $1${NC}"; }
warn() { echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠️  $1${NC}"; }
error() { echo -e "${RED}[$(date +'%H:%M:%S')] ❌ $1${NC}"; }
question() { echo -e "${BLUE}❓ $1${NC}"; }
info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

# --- Variáveis Globais ---
APP_NAME="ligai-dashboard"
APP_DISPLAY_NAME="LigAI Dashboard v4.1"
APP_DIRECTORY_DEFAULT="/opt/ligai"
APP_USER="ligai"
SCRIPT_VERSION="4.1.0"

# --- Limpeza em caso de falha ---
cleanup() {
    error "Instalação interrompida. Iniciando limpeza..."
    systemctl stop "$APP_NAME" 2>/dev/null || true
    systemctl disable "$APP_NAME" 2>/dev/null || true
    rm -f "/etc/systemd/system/${APP_NAME}.service"
    rm -f "/etc/nginx/sites-available/ligai"
    rm -f "/etc/nginx/sites-enabled/ligai"
    # Não remove o usuário ou o banco para permitir retentativa
    warn "Limpeza concluída. Alguns artefatos (usuário, banco) podem ter sido mantidos."
    exit 1
}

trap cleanup INT TERM ERR

# --- Funções de Instalação ---

show_banner() {
    clear
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║              🚀 LigAI Dashboard v4.1 (Robust) 🚀             ║"
    echo "║              Instalador Automático para VPS                 ║"
    echo "║                                                              ║"
    echo "║  ✅ Correção de Nginx e conflitos de configuração            ║"
    echo "║  ✅ Verificação de portas e requisitos aprimorada            ║"
    echo "║  ✅ Instalação segura com usuário dedicado                   ║"
    echo "║  ✅ Limpeza automática em caso de falha                      ║"
    echo "╚══════════════════════════════════════════════════════════════╝${NC}\n"
}

check_requirements() {
    log "Verificando requisitos do sistema..."
    if [[ $EUID -ne 0 ]]; then
        error "Este script precisa ser executado como root (use sudo)."
        exit 1
    fi
    if ! command -v apt &> /dev/null; then
        error "Este script é otimizado para sistemas baseados em Debian/Ubuntu."
        exit 1
    fi
    success "Requisitos básicos atendidos!"
}

check_ports() {
    log "Verificando se as portas necessárias estão livres..."
    local CONFLICT=0
    for port in 80 443 "$APP_PORT"; do
        if lsof -i :"$port" &>/dev/null; then
            error "A porta ${port} já está em uso. Libere-a antes de continuar."
            CONFLICT=1
        fi
    done
    if [[ $CONFLICT -eq 1 ]]; then
        exit 1
    fi
    success "Portas 80, 443 e ${APP_PORT} estão livres!"
}

collect_user_input() {
    log "Coletando configurações..."
    question "Digite o domínio para acesso (ex: dashboard.seusite.com):"
    read -r DOMAIN
    [[ -z "$DOMAIN" ]] && { error "Domínio é obrigatório!"; exit 1; }

    question "Porta da aplicação [3000]:"
    read -r APP_PORT
    APP_PORT=${APP_PORT:-3000}

    info "\nConfigurações do PostgreSQL:"
    question "Nome do banco de dados [ligai_db]:"
    read -r DB_NAME
    DB_NAME=${DB_NAME:-ligai_db}

    question "Usuário do banco [ligai_user]:"
    read -r DB_USER
    DB_USER=${DB_USER:-ligai_user}

    question "Senha do banco (será gerada uma senha forte se deixado em branco):"
    read -s DB_PASSWORD
    [[ -z "$DB_PASSWORD" ]] && DB_PASSWORD=$(openssl rand -base64 16)
    echo ""

    question "Diretório de instalação [${APP_DIRECTORY_DEFAULT}]:"
    read -r APP_DIRECTORY
    APP_DIRECTORY=${APP_DIRECTORY:-$APP_DIRECTORY_DEFAULT}

    question "Configurar SSL com Let's Encrypt? (s/N):"
    read -r SETUP_SSL

    info "\nResumo da instalação:"
    echo "  🌐 Domínio: ${DOMAIN}"
    echo "  🔌 Porta App: ${APP_PORT}"
    echo "  💾 Banco: ${DB_NAME} | Usuário: ${DB_USER}"
    echo "  📁 Diretório: ${APP_DIRECTORY}"
    echo "  🔒 SSL: $([[ "$SETUP_SSL" =~ ^[Ss]$ ]] && echo "Sim" || echo "Não")"
    
    question "\nContinuar com a instalação? (s/N):"
    read -r CONFIRM
    [[ ! "$CONFIRM" =~ ^[Ss]$ ]] && { error "Instalação cancelada."; exit 0; }
    
    check_ports # Verifica as portas após o usuário confirmar
}

update_system() {
    log "Atualizando sistema e instalando dependências básicas..."
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get upgrade -y
    apt-get install -y curl wget git unzip zip software-properties-common build-essential python3 lsof openssl
    success "Sistema atualizado!"
}

install_nodejs() {
    log "Instalando Node.js v20..."
    if command -v node &>/dev/null && [[ $(node -v) == v20* ]]; then
        success "Node.js v20 já está instalado."
        return
    fi
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    success "Node.js $(node -v ) e npm $(npm -v) instalados!"
}

install_postgresql() {
    log "Instalando e configurando PostgreSQL..."
    if systemctl is-active --quiet postgresql; then
        warn "PostgreSQL já parece estar instalado e rodando."
    else
        apt-get install -y postgresql postgresql-contrib
        systemctl start postgresql
        systemctl enable postgresql
        sleep 5 # Aguarda o serviço iniciar completamente
    fi

    log "Configurando banco de dados '${DB_NAME}'..."
    # Usar -v ON_ERROR_STOP=1 para garantir que o script pare em caso de erro no psql
    # A senha é passada via variável de ambiente para não aparecer no histórico de comandos
    PGPASSWORD="$DB_PASSWORD" su - postgres -c "psql -v ON_ERROR_STOP=1 --command=\"CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';\"" || warn "Usuário '${DB_USER}' talvez já exista. Continuando..."
    su - postgres -c "psql -v ON_ERROR_STOP=1 --command=\"CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};\"" || warn "Banco '${DB_NAME}' talvez já exista. Continuando..."
    su - postgres -c "psql -v ON_ERROR_STOP=1 --command=\"GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};\""
    
    # Teste de conexão
    if PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &>/dev/null; then
        success "PostgreSQL configurado com sucesso!"
    else
        error "Falha ao conectar ao banco de dados com as novas credenciais."
        exit 1
    fi
}

install_nginx() {
    log "Instalando e configurando Nginx..."
    apt-get install -y nginx
    systemctl stop nginx 2>/dev/null || true
    
    # Remover configurações padrão para evitar conflitos
    rm -f /etc/nginx/sites-enabled/default
    
    # Configuração do Nginx para a aplicação
    cat > "/etc/nginx/sites-available/ligai" << EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    # Otimizações e segurança
    client_max_body_size 50M; # Aumenta o limite de upload
    
    # Configurações de Gzip (sem duplicar)
    gzip on;
    gzip_disable "msie6";
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_buffers 16 8k;
    gzip_http_version 1.1;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
    
    ln -sf "/etc/nginx/sites-available/ligai" "/etc/nginx/sites-enabled/"
    
    if nginx -t; then
        systemctl start nginx
        systemctl enable nginx
        success "Nginx configurado!"
    else
        error "Erro na sintaxe da configuração do Nginx. Verifique o arquivo /etc/nginx/sites-available/ligai"
        nginx -t # Mostra o erro detalhado
        exit 1
    fi
}

setup_application( ) {
    log "Configurando ambiente da aplicação..."
    
    # Criar usuário e diretório
    if ! id "$APP_USER" &>/dev/null; then
        useradd -r -s /bin/bash -d "$APP_DIRECTORY" -m "$APP_USER"
        success "Usuário '${APP_USER}' criado."
    fi
    mkdir -p "$APP_DIRECTORY"
    
    log "Baixando ${APP_DISPLAY_NAME} do GitHub..."
    # Usar su para clonar como o usuário da aplicação
    su - "$APP_USER" -c "git clone https://github.com/marloncomverse16/LigaAIvendas.git '${APP_DIRECTORY}/temp'"
    # Mover arquivos para o diretório principal
    mv "${APP_DIRECTORY}/temp"/* "${APP_DIRECTORY}/"
    mv "${APP_DIRECTORY}/temp"/.* "${APP_DIRECTORY}/" 2>/dev/null || true # Move arquivos ocultos
    rm -rf "${APP_DIRECTORY}/temp"
    
    log "Criando arquivo de ambiente .env..."
    cat > "${APP_DIRECTORY}/.env" << EOF
# Variáveis de Ambiente - Gerado por script de instalação
NODE_ENV=production
PORT=${APP_PORT}
DOMAIN=${DOMAIN}
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}
# Adicione outras chaves de API e segredos aqui
EOF
    
    chown -R "$APP_USER:$APP_USER" "$APP_DIRECTORY"
    chmod -R 755 "$APP_DIRECTORY"
    
    log "Instalando dependências com 'npm install'..."
    # Instalar como o usuário da aplicação
    if su - "$APP_USER" -c "cd '$APP_DIRECTORY' && npm install --production --loglevel error"; then
        success "Dependências instaladas."
    else
        error "Falha ao instalar dependências com npm."
        exit 1
    fi
    
    # Build se necessário
    if grep -q '"build"' "${APP_DIRECTORY}/package.json"; then
        log "Executando build da aplicação..."
        su - "$APP_USER" -c "cd '$APP_DIRECTORY' && npm run build"
        success "Build concluído."
    fi
    
    success "Aplicação configurada em ${APP_DIRECTORY}!"
}

setup_systemd( ) {
    log "Configurando serviço com systemd..."
    cat > "/etc/systemd/system/${APP_NAME}.service" << EOF
[Unit]
Description=${APP_DISPLAY_NAME}
After=network.target postgresql.service nginx.service

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIRECTORY}
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
EnvironmentFile=${APP_DIRECTORY}/.env

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable "$APP_NAME"
    success "Serviço systemd configurado!"
}

setup_ssl() {
    if [[ "$SETUP_SSL" =~ ^[Ss]$ ]]; then
        log "Configurando SSL com Certbot..."
        apt-get install -y certbot python3-certbot-nginx
        
        # Parar Nginx temporariamente para o certbot usar a porta 80 se necessário
        systemctl stop nginx
        sleep 2
        
        if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "admin@${DOMAIN}" --redirect; then
            success "Certificado SSL gerado e configurado!"
        else
            warn "Falha na configuração do SSL. A aplicação funcionará via HTTP."
        fi
        # Reiniciar o Nginx é crucial aqui
        systemctl start nginx
    fi
}

start_services() {
    log "Iniciando todos os serviços..."
    systemctl start "$APP_NAME"
    systemctl restart nginx # Reinicia para garantir que todas as configs (incluindo SSL) sejam aplicadas
    
    sleep 5
    
    if ! systemctl is-active --quiet "$APP_NAME"; then
        error "O serviço da aplicação (${APP_NAME}) falhou ao iniciar."
        journalctl -u "$APP_NAME" -n 20 --no-pager
        exit 1
    fi
    if ! systemctl is-active --quiet "nginx"; then
        error "O serviço Nginx falhou ao iniciar."
        journalctl -u "nginx" -n 20 --no-pager
        exit 1
    fi
    
    success "Aplicação e Nginx estão rodando!"
}

show_final_info() {
    local URL_SCHEME="http"
    [[ "$SETUP_SSL" =~ ^[Ss]$ ]] && URL_SCHEME="https"
    
    echo -e "\n${GREEN}╔══════════════════════════════════════════════════════════════╗"
    echo "║               🎉 INSTALAÇÃO CONCLUÍDA COM SUCESSO!           ║"
    echo "╚══════════════════════════════════════════════════════════════╝${NC}\n"
    echo "🌐 Acesse sua aplicação em: ${URL_SCHEME}://${DOMAIN}"
    echo ""
    info "📋 Informações Importantes:"
    echo "   • Diretório da Aplicação: ${APP_DIRECTORY}"
    echo "   • Usuário da Aplicação: ${APP_USER}"
    echo "   • Credenciais do Banco: Ver arquivo .env em ${APP_DIRECTORY}"
    echo ""
    info "🔧 Comandos Úteis:"
    echo "   • Ver status da aplicação: sudo systemctl status ${APP_NAME}"
    echo "   • Ver logs da aplicação:   sudo journalctl -u ${APP_NAME} -f"
    echo "   • Reiniciar a aplicação:   sudo systemctl restart ${APP_NAME}"
    echo "   • Reiniciar o Nginx:       sudo systemctl restart nginx"
    echo ""
    success "${APP_DISPLAY_NAME} instalado e pronto para uso!"
}

# --- Função Principal ---
main( ) {
    show_banner
    check_requirements
    collect_user_input
    update_system
    install_nodejs
    install_postgresql
    install_nginx
    setup_application
    setup_systemd
    setup_ssl
    start_services
    show_final_info
}

# Executar o script
main "$@"
