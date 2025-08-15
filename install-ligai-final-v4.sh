#!/bin/bash

# LigAI Dashboard VPS Installer v5.2 (Final SU Command Fix)
# Script final que corrige a sintaxe do comando 'su' para garantir o caminho de execução correto.
# Autor: LigAI Team & Manus AI
# Data: 15/08/2025

set -e
set -o pipefail

# --- Cores e Funções de Logging ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}[$(date +'%H:%M:%S')] ✅ $1${NC}"; }
warn() { echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠️  $1${NC}"; }
error() { echo -e "${RED}[$(date +'%H:%M:%S')] ❌ $1${NC}"; }
question() { echo -e "${BLUE}❓ $1${NC}"; }
info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

# --- Variáveis Globais ---
APP_NAME="ligai-dashboard"
APP_DISPLAY_NAME="LigAI Dashboard v5.2"
APP_DIRECTORY_DEFAULT="/opt/ligai"
APP_USER="ligai"
GITHUB_REPO="https://github.com/marloncomverse16/LigaAIvendas.git"

# --- Limpeza em caso de falha ---
cleanup( ) {
    error "Instalação interrompida por erro na linha $1."
    systemctl stop "$APP_NAME" 2>/dev/null || true
    warn "Verifique os logs para depurar o problema."
    exit 1
}
trap 'cleanup $LINENO' INT TERM ERR

# --- Funções de Instalação ---

show_banner() {
    clear
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║        🚀 LigAI Dashboard v5.2 (Final SU Command Fix) 🚀     ║"
    echo "║              Instalador Inteligente para VPS                 ║"
    echo "║                                                              ║"
    echo "║  ✅ Corrige a sintaxe do comando 'su' para o Knex            ║"
    echo "║  ✅ Usa Knex para migrações e seeds (baseado no código-fonte)║"
    echo "║  ✅ Processo de deploy 100% alinhado com o projeto           ║"
    echo "╚══════════════════════════════════════════════════════════════╝${NC}\n"
}

check_requirements() {
    log "Verificando requisitos do sistema..."
    [[ $EUID -ne 0 ]] && { error "Execute como root (sudo)."; exit 1; }
    command -v apt-get >/dev/null || { error "Sistema não compatível com APT."; exit 1; }
    success "Requisitos básicos atendidos!"
}

collect_user_input() {
    log "Coletando configurações..."
    while true; do
        question "Digite o domínio para acesso (ex: dashboard.seusite.com):"
        read -r DOMAIN
        if [[ -z "$DOMAIN" ]]; then error "Domínio é obrigatório!"; elif ! [[ "$DOMAIN" =~ \. ]]; then error "Formato de domínio inválido."; else break; fi
    done
    question "Porta da aplicação [3000]:" && read -r APP_PORT && APP_PORT=${APP_PORT:-3000}
    info "\nConfigurações do PostgreSQL:"
    question "Nome do banco de dados [ligai_db]:" && read -r DB_NAME && DB_NAME=${DB_NAME:-ligai_db}
    question "Usuário do banco [ligai_user]:" && read -r DB_USER && DB_USER=${DB_USER:-ligai_user}
    question "Diretório de instalação [${APP_DIRECTORY_DEFAULT}]:" && read -r APP_DIRECTORY && APP_DIRECTORY=${APP_DIRECTORY:-$APP_DIRECTORY_DEFAULT}
    question "Configurar SSL com Let's Encrypt? (s/N):" && read -r SETUP_SSL

    info "\nResumo:"
    echo "  🌐 Domínio: ${DOMAIN} | 🔌 Porta: ${APP_PORT}"
    echo "  💾 Banco: ${DB_NAME} | 👤 Usuário DB: ${DB_USER}"
    echo "  📁 Diretório: ${APP_DIRECTORY} | 🔒 SSL: $([[ "$SETUP_SSL" =~ ^[Ss]$ ]] && echo "Sim" || echo "Não")"
    
    question "\nContinuar com a instalação? (s/N):" && read -r CONFIRM
    if [ "$(echo "$CONFIRM" | tr '[:upper:]' '[:lower:]')" != "s" ]; then
        error "Instalação cancelada." && exit 0
    fi
    log "Confirmação recebida. Iniciando instalação..." && sleep 1
}

update_system() {
    log "Atualizando sistema e instalando dependências..."
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y curl wget git unzip zip software-properties-common build-essential python3 lsof openssl
    success "Sistema atualizado!"
}

install_nodejs() {
    log "Verificando Node.js v20..."
    if command -v node &>/dev/null && [[ $(node -v) == v20* ]]; then
        success "Node.js v20 já está instalado."
    else
        log "Instalando Node.js v20..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
        success "Node.js $(node -v ) instalado!"
    fi
}

install_postgresql() {
    log "Configurando PostgreSQL..."
    apt-get install -y postgresql postgresql-contrib &>/dev/null
    systemctl -q is-active postgresql || systemctl start postgresql
    systemctl -q is-enabled postgresql || systemctl enable postgresql

    log "Recriando banco de dados para garantir um estado limpo para as migrações..."
    su - postgres -c "dropdb --if-exists ${DB_NAME}"
    su - postgres -c "dropuser --if-exists ${DB_USER}"
    
    DB_PASSWORD=$(openssl rand -hex 16)
    su - postgres -c "psql -c \"CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';\""
    su - postgres -c "createdb -O ${DB_USER} ${DB_NAME}"
    warn "Nova senha (URL-safe) gerada e salva no .env."
    success "Banco de dados recriado com sucesso."
}

install_nginx() {
    log "Configurando Nginx..."
    apt-get install -y nginx &>/dev/null
    log "Limpando configs antigas do Nginx..."
    rm -f /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/ligai /etc/nginx/conf.d/*.conf
    
    cat > "/etc/nginx/sites-available/ligai" << EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    client_max_body_size 50M;
    gzip on; gzip_vary on; gzip_proxied any; gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade; proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host; proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr; proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
    ln -sf "/etc/nginx/sites-available/ligai" "/etc/nginx/sites-enabled/"
    if nginx -t; then
        systemctl restart nginx && systemctl enable nginx
        success "Nginx configurado!"
    else
        error "Erro na sintaxe da config do Nginx." && nginx -t && exit 1
    fi
}

setup_application( ) {
    log "Configurando ambiente da aplicação..."
    id "$APP_USER" &>/dev/null || useradd -r -s /bin/bash -d "$APP_DIRECTORY" -m "$APP_USER"
    
    if [ -d "$APP_DIRECTORY" ]; then
        warn "Diretório ${APP_DIRECTORY} existe. Fazendo backup e recriando."
        mv "$APP_DIRECTORY" "${APP_DIRECTORY}.bak.$(date +%s)"
    fi
    mkdir -p "$APP_DIRECTORY" && chown "$APP_USER:$APP_USER" "$APP_DIRECTORY"

    log "Baixando aplicação de ${GITHUB_REPO}..."
    su "$APP_USER" -c "git clone --depth 1 ${GITHUB_REPO} '${APP_DIRECTORY}'"
    
    log "Criando arquivo .env..."
    cat > "${APP_DIRECTORY}/.env" << EOF
# Gerado em $(date)
NODE_ENV=production
PORT=${APP_PORT}
DOMAIN=${DOMAIN}
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}
EVOLUTION_API_URL=http://localhost:8080 # Exemplo, ajuste se necessário
EVOLUTION_API_KEY= # Adicione sua chave da API aqui
JWT_SECRET=$(openssl rand -hex 32 )
EOF
    chown "$APP_USER:$APP_USER" "${APP_DIRECTORY}/.env"

    log "Instalando todas as dependências..."
    # Executa o npm install dentro do diretório da aplicação
    su "$APP_USER" -c "cd '$APP_DIRECTORY' && NODE_ENV=development npm install --loglevel error"
    success "Dependências instaladas."
    
    # CORREÇÃO: Remover o '-' do 'su' para manter o diretório de trabalho correto.
    log "Executando migrações do Knex para criar as tabelas..."
    su "$APP_USER" -c "cd '$APP_DIRECTORY' && npx knex migrate:latest"
    success "Migrações do Knex concluídas."

    log "Executando seeds do Knex para popular o banco de dados..."
    su "$APP_USER" -c "cd '$APP_DIRECTORY' && npx knex seed:run"
    success "Seeds do Knex concluídos."

    log "Executando build da aplicação..."
    su "$APP_USER" -c "cd '$APP_DIRECTORY' && npm run build"
    success "Build da aplicação concluído."
    warn "As dependências de desenvolvimento serão mantidas para garantir a execução."
}

setup_systemd() {
    log "Configurando serviço com systemd..."
    cat > "/etc/systemd/system/${APP_NAME}.service" << EOF
[Unit]
Description=${APP_DISPLAY_NAME}
After=network.target postgresql.service

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIRECTORY}
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
EnvironmentFile=${APP_DIRECTORY}/.env

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload && systemctl enable "$APP_NAME"
    success "Serviço systemd configurado!"
}

setup_ssl() {
    if [[ "$SETUP_SSL" =~ ^[Ss]$ ]]; then
        log "Configurando SSL com Certbot..."
        apt-get install -y certbot python3-certbot-nginx
        if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "admin@${DOMAIN}" --redirect; then
            success "Certificado SSL gerado!"
        else
            warn "Falha na configuração do SSL."
        fi
        systemctl restart nginx
    fi
}

start_services() {
    log "Iniciando serviço da aplicação..."
    systemctl start "$APP_NAME" && sleep 5
    
    if ! systemctl is-active --quiet "$APP_NAME"; then
        error "O serviço da aplicação (${APP_NAME}) falhou ao iniciar."
        journalctl -u "$APP_NAME" -n 20 --no-pager
        exit 1
    fi
    success "Aplicação iniciada com sucesso!"
}

show_final_info() {
    local URL_SCHEME="http" && [[ "$SETUP_SSL" =~ ^[Ss]$ ]] && URL_SCHEME="https"
    echo -e "\n${GREEN}╔══════════════════════════════════════════════════════════════╗"
    echo "║               🎉 INSTALAÇÃO CONCLUÍDA COM SUCESSO!           ║"
    echo "╚══════════════════════════════════════════════════════════════╝${NC}\n"
    echo "🌐 Acesse sua aplicação em: ${URL_SCHEME}://${DOMAIN}"
    echo ""
    info "🔧 Comandos Úteis:"
    echo "   • Ver logs:   sudo journalctl -u ${APP_NAME} -f"
    echo "   • Reiniciar:  sudo systemctl restart ${APP_NAME}"
    echo ""
    success "${APP_DISPLAY_NAME} instalado e pronto para uso!"
}

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

main "$@"
