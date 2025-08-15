#!/bin/bash

# LigAI Dashboard VPS Installer v4.3 (Robust Input & Execution)
# Corrige o fluxo de execução após a confirmação do usuário e melhora validações.
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
APP_DISPLAY_NAME="LigAI Dashboard v4.3"
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
    echo "║           🚀 LigAI Dashboard v4.3 (Robust) 🚀                ║"
    echo "║              Instalador Inteligente para VPS                 ║"
    echo "║                                                              ║"
    echo "║  ✅ Fluxo de execução corrigido                              ║"
    echo "║  ✅ Gerenciamento interativo de banco de dados               ║"
    echo "║  ✅ Limpeza aprimorada de configs antigas                    ║"
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
        if [[ -z "$DOMAIN" ]]; then
            error "Domínio é obrigatório!"
        elif ! [[ "$DOMAIN" =~ \. ]]; then
            error "Formato de domínio inválido. Deve conter pelo menos um ponto (.)."
        else
            break
        fi
    done

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

    question "Diretório de instalação [${APP_DIRECTORY_DEFAULT}]:"
    read -r APP_DIRECTORY
    APP_DIRECTORY=${APP_DIRECTORY:-$APP_DIRECTORY_DEFAULT}

    question "Configurar SSL com Let's Encrypt? (s/N):"
    read -r SETUP_SSL

    info "\nResumo:"
    echo "  🌐 Domínio: ${DOMAIN} | 🔌 Porta: ${APP_PORT}"
    echo "  💾 Banco: ${DB_NAME} | 👤 Usuário DB: ${DB_USER}"
    echo "  📁 Diretório: ${APP_DIRECTORY} | 🔒 SSL: $([[ "$SETUP_SSL" =~ ^[Ss]$ ]] && echo "Sim" || echo "Não")"
    
    question "\nContinuar com a instalação? (s/N):"
    read -r CONFIRM
    # CORREÇÃO: Lógica de confirmação mais robusta
    if [ "$(echo "$CONFIRM" | tr '[:upper:]' '[:lower:]')" != "s" ]; then
        error "Instalação cancelada pelo usuário."
        exit 0
    fi
    
    # Feedback visual de que o script continuou
    log "Confirmação recebida. Iniciando instalação..."
    sleep 1
}

update_system() {
    log "Atualizando sistema e instalando dependências..."
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y curl wget git unzip zip software-properties-common build-essential python3 lsof openssl
    success "Sistema atualizado!"
}

install_nodejs() {
    log "Verificando instalação do Node.js v20..."
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
    log "Instalando e configurando PostgreSQL..."
    apt-get install -y postgresql postgresql-contrib &>/dev/null
    systemctl start postgresql
    systemctl enable postgresql

    if su - postgres -c "psql -lqt | cut -d \| -f 1 | grep -qw ${DB_NAME}"; then
        warn "O banco de dados '${DB_NAME}' já existe."
        question "O que você gostaria de fazer?"
        echo "  1) Usar o banco de dados existente (você precisará da senha)."
        echo "  2) DELETAR o banco de dados existente e criar um novo (DADOS SERÃO PERDIDOS)."
        echo "  3) Sair da instalação."
        read -r DB_CHOICE

        case $DB_CHOICE in
            1)
                log "Tentando usar o banco de dados existente."
                question "Por favor, digite a senha para o usuário '${DB_USER}':"
                read -s DB_PASSWORD
                echo ""
                if ! PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &>/dev/null; then
                    error "Senha incorreta ou falha na conexão. Saindo."
                    exit 1
                fi
                success "Conexão com o banco de dados existente bem-sucedida!"
                ;;
            2)
                log "Deletando e recriando o banco de dados..."
                su - postgres -c "dropdb ${DB_NAME}"
                su - postgres -c "dropuser ${DB_USER}" || warn "Usuário ${DB_USER} não existia, o que é normal."
                DB_PASSWORD=$(openssl rand -base64 16)
                su - postgres -c "psql -c \"CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';\""
                su - postgres -c "createdb -O ${DB_USER} ${DB_NAME}"
                info "Uma nova senha foi gerada para o usuário '${DB_USER}'."
                warn "A nova senha será salva automaticamente no arquivo .env."
                success "Banco de dados recriado com sucesso."
                ;;
            *)
                error "Saindo da instalação."
                exit 0
                ;;
        esac
    else
        log "Criando novo banco de dados e usuário..."
        DB_PASSWORD=$(openssl rand -base64 16)
        su - postgres -c "psql -c \"CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';\""
        su - postgres -c "createdb -O ${DB_USER} ${DB_NAME}"
        info "Uma nova senha foi gerada para o usuário '${DB_USER}'."
        warn "A nova senha será salva automaticamente no arquivo .env."
        success "Banco de dados criado com sucesso."
    fi
}

install_nginx() {
    log "Instalando e configurando Nginx..."
    apt-get install -y nginx &>/dev/null
    
    log "Limpando configurações antigas do Nginx para evitar conflitos..."
    rm -f /etc/nginx/sites-enabled/default
    rm -f /etc/nginx/sites-enabled/ligai # Limpa link simbólico antigo
    rm -f /etc/nginx/conf.d/*.conf # Limpa outros arquivos de conf que possam conflitar
    
    cat > "/etc/nginx/sites-available/ligai" << EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    client_max_body_size 50M;
    
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
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
        systemctl restart nginx
        systemctl enable nginx
        success "Nginx configurado e reiniciado com sucesso!"
    else
        error "Erro na sintaxe da configuração do Nginx."
        nginx -t
        exit 1
    fi
}

setup_application( ) {
    log "Configurando ambiente da aplicação..."
    if ! id "$APP_USER" &>/dev/null; then
        useradd -r -s /bin/bash -d "$APP_DIRECTORY" -m "$APP_USER"
    fi
    
    if [ -d "$APP_DIRECTORY" ]; then
        warn "Diretório de instalação ${APP_DIRECTORY} já existe. Fazendo backup e recriando para garantir uma instalação limpa."
        mv "$APP_DIRECTORY" "${APP_DIRECTORY}.bak.$(date +%s)"
    fi
    mkdir -p "$APP_DIRECTORY"
    chown "$APP_USER:$APP_USER" "$APP_DIRECTORY"

    log "Baixando aplicação de ${GITHUB_REPO}..."
    su - "$APP_USER" -c "git clone --depth 1 ${GITHUB_REPO} '${APP_DIRECTORY}'"
    
    log "Criando arquivo de ambiente .env..."
    cat > "${APP_DIRECTORY}/.env" << EOF
# Gerado em $(date)
NODE_ENV=production
PORT=${APP_PORT}
DOMAIN=${DOMAIN}
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}
EOF
    
    chown -R "$APP_USER:$APP_USER" "$APP_DIRECTORY"
    
    log "Instalando dependências (npm install)..."
    if su - "$APP_USER" -c "cd '$APP_DIRECTORY' && npm install --production --loglevel error"; then
        success "Dependências instaladas."
    else
        error "Falha ao instalar dependências com npm."
        exit 1
    fi
    
    if grep -q '"build"' "${APP_DIRECTORY}/package.json"; then
        log "Executando build da aplicação..."
        su - "$APP_USER" -c "cd '$APP_DIRECTORY' && npm run build"
        success "Build concluído."
    fi
}

setup_systemd() {
    log "Configurando serviço com systemd..."
    cat > "/etc/systemd/system/${APP_NAME}.service" << EOF
[Unit]
Description=${APP_DISPLAY_NAME}
After=network.target

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
        if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "admin@${DOMAIN}" --redirect; then
            success "Certificado SSL gerado e configurado!"
        else
            warn "Falha na configuração do SSL. A aplicação funcionará via HTTP."
        fi
        systemctl restart nginx
    fi
}

start_services() {
    log "Iniciando serviço da aplicação..."
    systemctl start "$APP_NAME"
    sleep 5
    
    if ! systemctl is-active --quiet "$APP_NAME"; then
        error "O serviço da aplicação (${APP_NAME}) falhou ao iniciar."
        journalctl -u "$APP_NAME" -n 20 --no-pager
        exit 1
    fi
    success "Aplicação iniciada com sucesso!"
}

show_final_info() {
    local URL_SCHEME="http"
    [[ "$SETUP_SSL" =~ ^[Ss]$ ]] && URL_SCHEME="https"
    
    echo -e "\n${GREEN}╔══════════════════════════════════════════════════════════════╗"
    echo "║               🎉 INSTALAÇÃO CONCLUÍDA COM SUCESSO!           ║"
    echo "╚══════════════════════════════════════════════════════════════╝${NC}\n"
    echo "🌐 Acesse sua aplicação em: ${URL_SCHEME}://${DOMAIN}"
    echo ""
    info "🔧 Comandos Úteis:"
    echo "   • Ver logs da aplicação:   sudo journalctl -u ${APP_NAME} -f"
    echo "   • Reiniciar a aplicação:   sudo systemctl restart ${APP_NAME}"
    echo "   • Ver status do Nginx:     sudo systemctl status nginx"
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

main "$@"
