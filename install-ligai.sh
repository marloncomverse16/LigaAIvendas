#!/bin/bash

# =============================================================================
# LigAI Dashboard - Instalador Automático para VPS (Versão Corrigida)
# =============================================================================
# Este script instala automaticamente o LigAI Dashboard em uma VPS Ubuntu/Debian
# Inclui: Node.js, PostgreSQL, Nginx, SSL/HTTPS, configuração de subdomínio
# PERMITE EXECUÇÃO COMO ROOT OU USUÁRIO NORMAL
# =============================================================================

set -e  # Parar se houver erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para log colorido
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

# Configurar variáveis baseado no usuário atual
configure_user() {
    if [[ $EUID -eq 0 ]]; then
        log "Executando como root - configurando para uso seguro"
        IS_ROOT=true
        DEFAULT_USER="ligai"
        DEFAULT_HOME="/home/$DEFAULT_USER"
        ACTUAL_USER="$DEFAULT_USER"
    else
        log "Executando como usuário normal: $(whoami)"
        IS_ROOT=false
        DEFAULT_USER="$USER"
        DEFAULT_HOME="/home/$USER"
        ACTUAL_USER="$USER"
    fi
    
    log "Usuário configurado: $ACTUAL_USER"
    log "Diretório home: $DEFAULT_HOME"
}

# Verificar sistema operacional
check_os() {
    if [[ ! -f /etc/os-release ]]; then
        error "Sistema operacional não suportado. Use Ubuntu ou Debian."
    fi
    
    . /etc/os-release
    if [[ "$ID" != "ubuntu" && "$ID" != "debian" ]]; then
        error "Sistema operacional não suportado: $ID. Use Ubuntu ou Debian."
    fi
    
    log "Sistema detectado: $PRETTY_NAME"
}

# Coletar informações do usuário
collect_info() {
    echo ""
    echo "=========================================="
    echo "   CONFIGURAÇÃO DO LIGAI DASHBOARD"
    echo "=========================================="
    echo ""
    
    # Domínio/Subdomínio
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
    echo "--- Configuração do Banco de Dados PostgreSQL ---"
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
    
    # Pasta de instalação
    read -p "Pasta de instalação [$DEFAULT_HOME/ligai]: " INSTALL_DIR
    INSTALL_DIR=${INSTALL_DIR:-$DEFAULT_HOME/ligai}
    
    echo ""
    echo "--- Resumo da Configuração ---"
    echo "Domínio: $DOMAIN"
    echo "Email SSL: $SSL_EMAIL"
    echo "Banco: $DB_NAME"
    echo "Usuário DB: $DB_USER"
    echo "Porta: $APP_PORT"
    echo "Pasta: $INSTALL_DIR"
    echo "Usuário sistema: $ACTUAL_USER"
    echo ""
    
    read -p "Continuar com esta configuração? (y/N): " CONFIRM
    if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
        error "Instalação cancelada pelo usuário."
    fi
}

# Atualizar sistema
update_system() {
    log "Atualizando sistema..."
    apt update && apt upgrade -y
    apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release
}

# Instalar Node.js
install_nodejs() {
    log "Instalando Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
    
    # Verificar instalação
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    log "Node.js instalado: $NODE_VERSION"
    log "npm instalado: $NPM_VERSION"
}

# Verificar se banco de dados existe
check_existing_database() {
    log "Verificando banco de dados existente..."
    
    # Verificar se PostgreSQL está instalado
    if ! command -v psql &> /dev/null; then
        log "PostgreSQL não está instalado. Será instalado automaticamente."
        return 1
    fi
    
    # Verificar se PostgreSQL está rodando
    if ! systemctl is-active --quiet postgresql; then
        log "PostgreSQL está instalado mas não está rodando. Iniciando..."
        systemctl start postgresql
    fi
    
    # Verificar se o banco existe
    if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
        warn "Banco de dados '$DB_NAME' já existe!"
        echo ""
        echo "O que você deseja fazer?"
        echo "1) Usar o banco existente (recomendado para atualizações)"
        echo "2) Criar um novo banco com nome diferente"
        echo "3) Remover o banco existente e criar novo (CUIDADO: dados serão perdidos)"
        echo "4) Cancelar instalação"
        echo ""
        
        while true; do
            read -p "Digite sua opção (1-4): " DB_CHOICE
            case $DB_CHOICE in
                1)
                    log "Usando banco existente: $DB_NAME"
                    USE_EXISTING_DB=true
                    # Verificar se usuário existe
                    if ! sudo -u postgres psql -t -c "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
                        log "Criando usuário '$DB_USER' para banco existente..."
                        sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" || true
                        sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" || true
                        sudo -u postgres psql -c "ALTER USER $DB_USER CREATEDB;" || true
                    else
                        info "Usuário '$DB_USER' já existe. Verificando permissões..."
                        sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" || true
                        sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" || true
                    fi
                    break
                    ;;
                2)
                    echo ""
                    read -p "Digite o nome do novo banco: " NEW_DB_NAME
                    if [[ -z "$NEW_DB_NAME" ]]; then
                        warn "Nome do banco não pode estar vazio!"
                        continue
                    fi
                    if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw "$NEW_DB_NAME"; then
                        warn "Banco '$NEW_DB_NAME' também já existe!"
                        continue
                    fi
                    DB_NAME="$NEW_DB_NAME"
                    log "Criando novo banco: $DB_NAME"
                    USE_EXISTING_DB=false
                    break
                    ;;
                3)
                    warn "ATENÇÃO: Isso irá APAGAR TODOS OS DADOS do banco '$DB_NAME'!"
                    read -p "Tem certeza? Digite 'CONFIRMO' para continuar: " CONFIRM_DELETE
                    if [[ "$CONFIRM_DELETE" == "CONFIRMO" ]]; then
                        log "Removendo banco existente..."
                        sudo -u postgres psql -c "DROP DATABASE IF EXISTS $DB_NAME;"
                        USE_EXISTING_DB=false
                        break
                    else
                        warn "Operação cancelada."
                        continue
                    fi
                    ;;
                4)
                    error "Instalação cancelada pelo usuário."
                    ;;
                *)
                    warn "Opção inválida! Digite 1, 2, 3 ou 4."
                    ;;
            esac
        done
        
        return 0
    else
        log "Banco de dados '$DB_NAME' não existe. Será criado."
        USE_EXISTING_DB=false
        return 1
    fi
}

# Instalar PostgreSQL
install_postgresql() {
    log "Instalando PostgreSQL..."
    apt install -y postgresql postgresql-contrib
    
    # Iniciar serviço
    systemctl start postgresql
    systemctl enable postgresql
    
    log "Configurando banco de dados..."
    
    # Se não está usando banco existente, criar novo
    if [[ "$USE_EXISTING_DB" != "true" ]]; then
        # Criar usuário (se não existir)
        if ! sudo -u postgres psql -t -c "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
            log "Criando usuário do banco: $DB_USER"
            sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
        else
            log "Usuário '$DB_USER' já existe. Atualizando senha..."
            sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
        fi
        
        # Criar banco
        log "Criando banco de dados: $DB_NAME"
        sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
        sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
        sudo -u postgres psql -c "ALTER USER $DB_USER CREATEDB;"
    fi
    
    # Configurar acesso local
    log "Configurando acesso ao PostgreSQL..."
    
    # Backup da configuração original
    cp /etc/postgresql/*/main/pg_hba.conf /etc/postgresql/*/main/pg_hba.conf.backup 2>/dev/null || true
    
    # Permitir acesso local com senha
    if ! grep -q "local.*$DB_NAME.*$DB_USER.*md5" /etc/postgresql/*/main/pg_hba.conf 2>/dev/null; then
        echo "local   $DB_NAME   $DB_USER   md5" >> /etc/postgresql/*/main/pg_hba.conf
    fi
    
    # Reiniciar PostgreSQL para aplicar mudanças
    systemctl restart postgresql
    
    # Testar conexão
    log "Testando conexão com banco de dados..."
    if PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
        log "Conexão com banco de dados testada com sucesso!"
    else
        warn "Não foi possível testar a conexão. Verifique as configurações depois."
    fi
    
    log "PostgreSQL configurado com sucesso!"
}

# Instalar Nginx
install_nginx() {
    log "Instalando Nginx..."
    apt install -y nginx
    
    # Iniciar serviços
    systemctl start nginx
    systemctl enable nginx
    
    log "Nginx instalado e iniciado!"
}

# Instalar Certbot para SSL
install_certbot() {
    log "Instalando Certbot para SSL..."
    apt install -y certbot python3-certbot-nginx
}

# Criar usuário se necessário (quando executado como root)
create_user_if_needed() {
    if [[ "$IS_ROOT" == "true" ]]; then
        if ! id "$DEFAULT_USER" &>/dev/null; then
            log "Criando usuário $DEFAULT_USER..."
            useradd -m -s /bin/bash "$DEFAULT_USER"
            usermod -aG sudo "$DEFAULT_USER"
            log "Usuário $DEFAULT_USER criado com sucesso!"
        else
            log "Usuário $DEFAULT_USER já existe."
        fi
    fi
}

# Configurar aplicação
setup_application() {
    log "Configurando aplicação LigAI..."
    
    # Criar usuário se necessário
    create_user_if_needed
    
    # Criar diretório
    mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    
    # Se já existe, fazer backup
    if [[ -d ".git" ]]; then
        warn "Diretório já contém uma instalação. Fazendo backup..."
        cp -r . "../ligai_backup_$(date +%Y%m%d_%H%M%S)"
        git pull
    else
        log "Criando estrutura da aplicação..."
        
        # Estrutura básica (adapte conforme seu repositório)
        mkdir -p {client/src,server,shared,uploads}
        
        # Arquivo package.json básico
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
    fi
    
    # Instalar dependências
    log "Instalando dependências..."
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

# Configuração de Sessão (gere uma chave segura)
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
    
    # Dar permissões adequadas
    chown -R "$ACTUAL_USER:$ACTUAL_USER" "$INSTALL_DIR"
    chmod 600 .env
    
    log "Aplicação configurada!"
}

# Configurar Nginx
configure_nginx() {
    log "Configurando Nginx..."
    
    # Backup da configuração original
    cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
    
    # Verificar e corrigir configuração principal do nginx
    if grep -c "gzip.*on" /etc/nginx/nginx.conf | grep -q "[2-9]"; then
        log "Corrigindo configuração gzip duplicada no nginx.conf..."
        # Remover configurações de gzip duplicadas (manter apenas uma)
        sed -i '/gzip/d' /etc/nginx/nginx.conf
        # Adicionar configuração gzip correta na seção http
        sed -i '/http {/a\\n\t# Gzip Settings\n\tgzip on;\n\tgzip_vary on;\n\tgzip_proxied any;\n\tgzip_comp_level 6;\n\tgzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;\n' /etc/nginx/nginx.conf
    fi
    
    # Criar configuração do site
    tee /etc/nginx/sites-available/$DOMAIN > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Redirecionamento temporário para HTTPS (será configurado pelo Certbot)
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
        
        # Aumentar timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Configuração para WebSocket
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

    # Configuração para uploads
    location /uploads {
        alias $INSTALL_DIR/uploads;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Configurações de segurança
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";
}
EOF
    
    # Habilitar site
    ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
    
    # Remover configuração padrão
    rm -f /etc/nginx/sites-enabled/default
    
    # Testar configuração
    nginx -t
    
    # Recarregar Nginx
    systemctl reload nginx
    
    log "Nginx configurado!"
}

# Configurar SSL com Let's Encrypt
configure_ssl() {
    log "Configurando SSL/HTTPS..."
    
    # Verificar se o domínio aponta para o servidor
    warn "IMPORTANTE: Certifique-se de que o domínio $DOMAIN aponta para este servidor!"
    warn "O DNS pode levar alguns minutos para propagar."
    
    read -p "O domínio já aponta para este servidor? (y/N): " DNS_READY
    if [[ ! "$DNS_READY" =~ ^[Yy]$ ]]; then
        warn "Configure o DNS primeiro e execute novamente: certbot --nginx -d $DOMAIN"
        return
    fi
    
    # Obter certificado SSL
    certbot --nginx -d $DOMAIN --email $SSL_EMAIL --agree-tos --non-interactive --redirect
    
    # Configurar renovação automática
    systemctl enable certbot.timer
    
    log "SSL configurado com sucesso!"
}

# Criar serviço systemd
create_service() {
    log "Criando serviço systemd..."
    
    # Verificar se usuário existe
    if ! id "$ACTUAL_USER" &>/dev/null; then
        warn "Usuário $ACTUAL_USER não existe. Criando..."
        if [[ "$IS_ROOT" == "true" ]]; then
            # Criar usuário ligai se não existir
            useradd -m -s /bin/bash "$ACTUAL_USER" || true
            usermod -aG sudo "$ACTUAL_USER" || true
        else
            error "Não é possível criar usuário $ACTUAL_USER sem privilégios de root"
        fi
    fi
    
    # Verificar se diretório existe e tem permissões corretas
    if [[ ! -d "$INSTALL_DIR" ]]; then
        mkdir -p "$INSTALL_DIR"
    fi
    
    chown -R "$ACTUAL_USER:$ACTUAL_USER" "$INSTALL_DIR"
    
    tee /etc/systemd/system/ligai.service > /dev/null << EOF
[Unit]
Description=LigAI Dashboard - Gestão de Leads WhatsApp
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=$ACTUAL_USER
Group=$ACTUAL_USER
WorkingDirectory=$INSTALL_DIR
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

# Configurações de segurança (mais flexíveis)
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=false
ReadWritePaths=$INSTALL_DIR
ReadWritePaths=/tmp

[Install]
WantedBy=multi-user.target
EOF
    
    # Recarregar systemd
    systemctl daemon-reload
    
    # Habilitar serviço
    systemctl enable ligai
    
    log "Serviço systemd criado!"
}

# Configurar firewall
configure_firewall() {
    log "Configurando firewall..."
    
    # Instalar ufw se não estiver instalado
    apt install -y ufw
    
    # Configurar regras básicas
    ufw default deny incoming
    ufw default allow outgoing
    
    # Permitir SSH
    ufw allow ssh
    
    # Permitir HTTP e HTTPS
    ufw allow 'Nginx Full'
    
    # Habilitar firewall
    ufw --force enable
    
    log "Firewall configurado!"
}

# Executar migrações do banco
run_migrations() {
    log "Executando migrações do banco de dados..."
    
    cd "$INSTALL_DIR"
    
    # Se existe drizzle-kit, executar migrações
    if npm list drizzle-kit &> /dev/null; then
        npm run db:push
    else
        warn "drizzle-kit não encontrado. Execute as migrações manualmente após configurar o código."
    fi
}

# Iniciar aplicação
start_application() {
    log "Iniciando aplicação..."
    
    cd "$INSTALL_DIR"
    
    # Build da aplicação se necessário
    if [[ -f "vite.config.ts" ]]; then
        npm run build || warn "Build falhou - continue com modo desenvolvimento"
    fi
    
    # Iniciar serviço
    systemctl start ligai
    
    # Verificar status
    sleep 5
    if systemctl is-active --quiet ligai; then
        log "Aplicação iniciada com sucesso!"
    else
        error "Falha ao iniciar aplicação. Verifique: journalctl -u ligai -f"
    fi
}

# Exibir informações finais
show_final_info() {
    echo ""
    echo "=========================================="
    echo "   INSTALAÇÃO CONCLUÍDA COM SUCESSO!"
    echo "=========================================="
    echo ""
    echo "🌐 Acesse sua aplicação em: https://$DOMAIN"
    echo "🗄️  Banco de dados: $DB_NAME"
    echo "👤 Usuário sistema: $ACTUAL_USER"
    echo "📁 Pasta da aplicação: $INSTALL_DIR"
    echo ""
    echo "--- Comandos Úteis ---"
    echo "• Status da aplicação:    systemctl status ligai"
    echo "• Logs da aplicação:      journalctl -u ligai -f"
    echo "• Reiniciar aplicação:    systemctl restart ligai"
    echo "• Parar aplicação:        systemctl stop ligai"
    echo "• Status do Nginx:        systemctl status nginx"
    echo "• Renovar SSL:            certbot renew"
    echo ""
    echo "--- Próximos Passos ---"
    echo "1. Acesse https://$DOMAIN e configure sua conta"
    echo "2. Configure suas integrações WhatsApp"
    echo "3. Importe seus contatos e leads"
    echo ""
    echo "📚 Documentação: https://github.com/seu-repo/ligai-dashboard"
    echo "🆘 Suporte: contato@ligai.com.br"
    echo ""
    warn "Mantenha suas credenciais em local seguro!"
    warn "Faça backup regular do banco de dados!"
}

# Função principal
main() {
    echo ""
    echo "🚀 LigAI Dashboard - Instalador Automático (Versão Corrigida)"
    echo "=============================================================="
    echo ""
    
    configure_user
    check_os
    collect_info
    
    log "Iniciando instalação..."
    
    update_system
    install_nodejs
    check_existing_database
    install_postgresql
    install_nginx
    install_certbot
    configure_firewall
    setup_application
    configure_nginx
    configure_ssl
    create_service
    run_migrations
    start_application
    show_final_info
    
    log "Instalação concluída com sucesso! 🎉"
}

# Executar função principal
main "$@"