#!/bin/bash

# =============================================================================
# LigAI Dashboard - Instalador Definitivo (SEM PROBLEMAS DE PERMISSÃO)
# =============================================================================
# Este script instala corretamente o LigAI Dashboard resolvendo todos os
# problemas de permissão de usuário e diretório
# =============================================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[AVISO] $1${NC}"
}

error() {
    echo -e "${RED}[ERRO] $1${NC}"
    exit 1
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Detectar usuário atual corretamente
detect_current_user() {
    if [[ $EUID -eq 0 ]]; then
        # Se for root, usar root mesmo
        CURRENT_USER="root"
        USER_HOME="/root"
        log "Detectado usuário root - usando /root"
    else
        # Se não for root, usar usuário atual
        CURRENT_USER="$USER"
        USER_HOME="$HOME"
        log "Detectado usuário: $CURRENT_USER - usando $USER_HOME"
    fi
    
    # Definir diretório da aplicação baseado no usuário atual
    APP_DIRECTORY="$USER_HOME/ligai"
    
    log "Usuário do sistema: $CURRENT_USER"
    log "Diretório home: $USER_HOME"
    log "Diretório da aplicação: $APP_DIRECTORY"
}

# Verificar privilégios
check_privileges() {
    if [[ $EUID -eq 0 ]]; then
        SUDO_CMD=""
        log "Executando como root"
    elif sudo -n true 2>/dev/null; then
        SUDO_CMD="sudo"
        log "Executando com sudo disponível"
    else
        error "Este script precisa de privilégios sudo. Execute: sudo $0"
    fi
}

# Verificar sistema operacional
check_os() {
    if [[ ! -f /etc/os-release ]]; then
        error "Sistema operacional não suportado"
    fi
    
    . /etc/os-release
    if [[ "$ID" != "ubuntu" && "$ID" != "debian" ]]; then
        error "Sistema operacional não suportado: $ID. Use Ubuntu ou Debian."
    fi
    
    log "Sistema detectado: $PRETTY_NAME"
}

# Coletar informações
collect_info() {
    echo ""
    echo "=========================================="
    echo "   CONFIGURAÇÃO DO LIGAI DASHBOARD"
    echo "=========================================="
    echo ""
    
    # Mostrar configuração detectada
    echo "--- Configuração Detectada ---"
    echo "Usuário: $CURRENT_USER"
    echo "Pasta home: $USER_HOME"
    echo "Pasta da aplicação: $APP_DIRECTORY"
    echo ""
    
    # Domínio
    read -p "Digite o domínio ou subdomínio (ex: ligai.meudominio.com): " DOMAIN
    if [[ -z "$DOMAIN" ]]; then
        error "Domínio é obrigatório!"
    fi
    
    # Email para SSL
    read -p "Digite seu email para o certificado SSL: " SSL_EMAIL
    if [[ -z "$SSL_EMAIL" ]]; then
        error "Email é obrigatório para o certificado SSL!"
    fi
    
    # Configurações do PostgreSQL
    echo ""
    echo "--- Configuração do Banco de Dados ---"
    read -p "Nome do banco de dados [ligai]: " DB_NAME
    DB_NAME=${DB_NAME:-ligai}
    
    read -p "Usuário do banco [ligai_user]: " DB_USER
    DB_USER=${DB_USER:-ligai_user}
    
    while true; do
        read -s -p "Senha do banco de dados: " DB_PASSWORD
        echo
        if [[ -z "$DB_PASSWORD" ]]; then
            warn "Senha não pode estar vazia!"
            continue
        fi
        read -s -p "Confirme a senha: " DB_PASSWORD_CONFIRM
        echo
        if [[ "$DB_PASSWORD" == "$DB_PASSWORD_CONFIRM" ]]; then
            break
        else
            warn "Senhas não coincidem!"
        fi
    done
    
    # Porta da aplicação
    read -p "Porta da aplicação [5000]: " APP_PORT
    APP_PORT=${APP_PORT:-5000}
    
    echo ""
    echo "--- Resumo da Configuração ---"
    echo "Usuário sistema: $CURRENT_USER"
    echo "Pasta aplicação: $APP_DIRECTORY"
    echo "Domínio: $DOMAIN"
    echo "Email SSL: $SSL_EMAIL"
    echo "Banco: $DB_NAME"
    echo "Usuário DB: $DB_USER"
    echo "Porta: $APP_PORT"
    echo ""
    
    read -p "Continuar com esta configuração? (y/N): " CONFIRM
    if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
        error "Instalação cancelada"
    fi
}

# Atualizar sistema
update_system() {
    log "Atualizando sistema..."
    $SUDO_CMD apt update && $SUDO_CMD apt upgrade -y
    $SUDO_CMD apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release
}

# Instalar Node.js
install_nodejs() {
    log "Instalando Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO_CMD bash -
    $SUDO_CMD apt install -y nodejs
    
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    log "Node.js instalado: $NODE_VERSION"
    log "npm instalado: $NPM_VERSION"
}

# Instalar PostgreSQL
install_postgresql() {
    log "Instalando PostgreSQL..."
    $SUDO_CMD apt install -y postgresql postgresql-contrib
    
    $SUDO_CMD systemctl start postgresql
    $SUDO_CMD systemctl enable postgresql
    
    log "Configurando banco de dados..."
    
    # Criar usuário
    if ! $SUDO_CMD -u postgres psql -t -c "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
        log "Criando usuário do banco: $DB_USER"
        $SUDO_CMD -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
    else
        log "Atualizando senha do usuário $DB_USER"
        $SUDO_CMD -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
    fi
    
    # Criar banco
    if ! $SUDO_CMD -u postgres psql -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
        log "Criando banco de dados: $DB_NAME"
        $SUDO_CMD -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
    else
        log "Banco de dados $DB_NAME já existe"
    fi
    
    $SUDO_CMD -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
    $SUDO_CMD -u postgres psql -c "ALTER USER $DB_USER CREATEDB;"
    
    # Configurar acesso local
    log "Configurando acesso ao PostgreSQL..."
    
    # Backup da configuração
    $SUDO_CMD cp /etc/postgresql/*/main/pg_hba.conf /etc/postgresql/*/main/pg_hba.conf.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
    
    # Permitir acesso local
    if ! grep -q "local.*$DB_NAME.*$DB_USER.*md5" /etc/postgresql/*/main/pg_hba.conf 2>/dev/null; then
        echo "local   $DB_NAME   $DB_USER   md5" | $SUDO_CMD tee -a /etc/postgresql/*/main/pg_hba.conf
    fi
    
    $SUDO_CMD systemctl restart postgresql
    
    log "PostgreSQL configurado!"
}

# Instalar Nginx
install_nginx() {
    log "Instalando Nginx..."
    $SUDO_CMD apt install -y nginx
    
    $SUDO_CMD systemctl start nginx
    $SUDO_CMD systemctl enable nginx
}

# Instalar Certbot
install_certbot() {
    log "Instalando Certbot..."
    $SUDO_CMD apt install -y certbot python3-certbot-nginx
}

# Criar diretório da aplicação com permissões corretas
setup_application_directory() {
    log "Configurando diretório da aplicação..."
    
    # Remover diretório se existir (para reinstalação limpa)
    if [[ -d "$APP_DIRECTORY" ]]; then
        warn "Diretório $APP_DIRECTORY já existe. Fazendo backup..."
        if [[ -d "$APP_DIRECTORY.backup" ]]; then
            rm -rf "$APP_DIRECTORY.backup"
        fi
        mv "$APP_DIRECTORY" "$APP_DIRECTORY.backup.$(date +%Y%m%d_%H%M%S)"
    fi
    
    # Criar diretório
    mkdir -p "$APP_DIRECTORY"
    cd "$APP_DIRECTORY"
    
    # Definir ownership correto
    if [[ "$CURRENT_USER" == "root" ]]; then
        chown -R root:root "$APP_DIRECTORY"
    else
        $SUDO_CMD chown -R "$CURRENT_USER:$CURRENT_USER" "$APP_DIRECTORY"
    fi
    
    # Definir permissões corretas
    chmod 755 "$APP_DIRECTORY"
    
    log "Diretório da aplicação configurado: $APP_DIRECTORY"
}

# Configurar aplicação
setup_application() {
    log "Configurando aplicação LigAI..."
    
    cd "$APP_DIRECTORY"
    
    # Criar estrutura da aplicação
    mkdir -p {client/src,server,shared,uploads}
    
    # package.json
    cat > package.json << EOF
{
  "name": "ligai-dashboard",
  "version": "1.0.0",
  "description": "LigAI Dashboard - Gestão de Leads WhatsApp",
  "main": "server/index.ts",
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "build": "npm run build:client && npm run build:server",
    "build:client": "vite build",
    "build:server": "tsc -p server/tsconfig.json",
    "start": "NODE_ENV=production node dist/server/index.js",
    "db:push": "drizzle-kit push:pg",
    "db:migrate": "drizzle-kit generate:pg && drizzle-kit push:pg"
  },
  "dependencies": {
    "express": "^4.18.2",
    "typescript": "^5.0.0",
    "tsx": "^4.7.0",
    "drizzle-orm": "^0.29.0",
    "postgres": "^3.4.3",
    "@types/node": "^20.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0"
  }
}
EOF
    
    # Instalar dependências
    log "Instalando dependências npm..."
    npm install
    
    # Criar arquivo .env
    log "Criando arquivo de configuração..."
    cat > .env << EOF
# Configuração do Banco de Dados
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME

# Configuração da Aplicação
NODE_ENV=production
PORT=$APP_PORT
DOMAIN=$DOMAIN

# Configuração de Sessão
SESSION_SECRET=$(openssl rand -base64 32)

# Configuração de Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# URLs da aplicação
BASE_URL=https://$DOMAIN
API_URL=https://$DOMAIN/api

# Configurações de CORS
CORS_ORIGIN=https://$DOMAIN
EOF
    
    # Ajustar permissões finais
    chmod 600 .env
    if [[ "$CURRENT_USER" == "root" ]]; then
        chown -R root:root "$APP_DIRECTORY"
    else
        $SUDO_CMD chown -R "$CURRENT_USER:$CURRENT_USER" "$APP_DIRECTORY"
    fi
    
    log "Aplicação configurada!"
}

# Configurar Nginx
configure_nginx() {
    log "Configurando Nginx..."
    
    # Backup e limpeza da configuração nginx
    $SUDO_CMD cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
    
    # Criar configuração nginx limpa
    $SUDO_CMD tee /etc/nginx/nginx.conf > /dev/null << 'EOF'
user www-data;
worker_processes auto;
pid /run/nginx.pid;
include /etc/nginx/modules-enabled/*.conf;

events {
    worker_connections 768;
}

http {
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    ssl_protocols TLSv1 TLSv1.1 TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
EOF
    
    # Criar configuração do site
    $SUDO_CMD tee /etc/nginx/sites-available/$DOMAIN > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location /api/ws {
        proxy_pass http://localhost:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /uploads {
        alias $APP_DIRECTORY/uploads;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";
}
EOF
    
    # Habilitar site
    $SUDO_CMD ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
    $SUDO_CMD rm -f /etc/nginx/sites-enabled/default
    
    # Testar configuração
    $SUDO_CMD nginx -t
    $SUDO_CMD systemctl reload nginx
    
    log "Nginx configurado!"
}

# Configurar SSL
configure_ssl() {
    log "Configurando SSL..."
    
    warn "IMPORTANTE: Certifique-se de que o domínio $DOMAIN aponta para este servidor!"
    
    read -p "O domínio já aponta para este servidor? (y/N): " DNS_READY
    if [[ ! "$DNS_READY" =~ ^[Yy]$ ]]; then
        warn "Configure o DNS primeiro e execute: sudo certbot --nginx -d $DOMAIN"
        return
    fi
    
    $SUDO_CMD certbot --nginx -d $DOMAIN --email $SSL_EMAIL --agree-tos --non-interactive --redirect
    $SUDO_CMD systemctl enable certbot.timer
    
    log "SSL configurado!"
}

# Criar serviço systemd CORRETO
create_service() {
    log "Criando serviço systemd..."
    
    # Garantir que o diretório existe e tem permissões corretas
    if [[ ! -d "$APP_DIRECTORY" ]]; then
        error "Diretório da aplicação não existe: $APP_DIRECTORY"
    fi
    
    # Verificar permissões do diretório
    if [[ "$CURRENT_USER" == "root" ]]; then
        chown -R root:root "$APP_DIRECTORY"
        chmod -R 755 "$APP_DIRECTORY"
    else
        $SUDO_CMD chown -R "$CURRENT_USER:$CURRENT_USER" "$APP_DIRECTORY"
        $SUDO_CMD chmod -R 755 "$APP_DIRECTORY"
    fi
    
    log "Diretório verificado: $APP_DIRECTORY"
    log "Proprietário: $CURRENT_USER"
    
    # Criar serviço systemd
    $SUDO_CMD tee /etc/systemd/system/ligai.service > /dev/null << EOF
[Unit]
Description=LigAI Dashboard - Gestão de Leads WhatsApp
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=$CURRENT_USER
Group=$CURRENT_USER
WorkingDirectory=$APP_DIRECTORY
Environment=NODE_ENV=production
Environment=PATH=/usr/bin:/usr/local/bin
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ligai

# Configurações de timeout
TimeoutStartSec=60
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
EOF
    
    # Recarregar e habilitar
    $SUDO_CMD systemctl daemon-reload
    $SUDO_CMD systemctl enable ligai
    
    log "Serviço systemd criado e habilitado!"
}

# Configurar firewall
configure_firewall() {
    log "Configurando firewall..."
    
    $SUDO_CMD apt install -y ufw
    $SUDO_CMD ufw default deny incoming
    $SUDO_CMD ufw default allow outgoing
    $SUDO_CMD ufw allow ssh
    $SUDO_CMD ufw allow 'Nginx Full'
    $SUDO_CMD ufw --force enable
    
    log "Firewall configurado!"
}

# Iniciar aplicação
start_application() {
    log "Iniciando aplicação..."
    
    cd "$APP_DIRECTORY"
    
    # Build se necessário
    if [[ -f "vite.config.ts" ]]; then
        npm run build || warn "Build falhou - continuando"
    fi
    
    # Iniciar serviço
    $SUDO_CMD systemctl start ligai
    
    # Aguardar inicialização
    sleep 5
    
    # Verificar status
    if $SUDO_CMD systemctl is-active --quiet ligai; then
        log "✅ Aplicação iniciada com sucesso!"
        return 0
    else
        error "❌ Falha ao iniciar aplicação. Logs: sudo journalctl -u ligai -f"
    fi
}

# Exibir informações finais
show_final_info() {
    echo ""
    echo "=========================================="
    echo "   INSTALAÇÃO CONCLUÍDA COM SUCESSO!"
    echo "=========================================="
    echo ""
    echo "🌐 Acesse: https://$DOMAIN"
    echo "🗄️ Banco: $DB_NAME"
    echo "👤 Usuário: $CURRENT_USER"
    echo "📁 Pasta: $APP_DIRECTORY"
    echo ""
    echo "--- Comandos Úteis ---"
    echo "• Status:      sudo systemctl status ligai"
    echo "• Logs:        sudo journalctl -u ligai -f"
    echo "• Reiniciar:   sudo systemctl restart ligai"
    echo "• Parar:       sudo systemctl stop ligai"
    echo ""
    log "Instalação concluída! 🎉"
}

# Função principal
main() {
    echo ""
    echo "🚀 LigAI Dashboard - Instalador Definitivo"
    echo "==========================================="
    echo ""
    
    detect_current_user
    check_privileges
    check_os
    collect_info
    
    log "Iniciando instalação..."
    
    update_system
    install_nodejs
    install_postgresql
    install_nginx
    install_certbot
    configure_firewall
    setup_application_directory
    setup_application
    configure_nginx
    configure_ssl
    create_service
    start_application
    show_final_info
}

# Executar
main "$@"