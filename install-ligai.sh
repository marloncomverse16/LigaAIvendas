#!/bin/bash

# =============================================================================
# LigAI Dashboard - Instalador Automático para VPS
# =============================================================================
# Este script instala automaticamente o LigAI Dashboard em uma VPS Ubuntu/Debian
# Inclui: Node.js, PostgreSQL, Nginx, SSL/HTTPS, configuração de subdomínio
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

# Verificar se é root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        error "Este script não deve ser executado como root. Use um usuário com sudo."
    fi
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
    read -p "Pasta de instalação [/home/$USER/ligai]: " INSTALL_DIR
    INSTALL_DIR=${INSTALL_DIR:-/home/$USER/ligai}
    
    echo ""
    echo "--- Resumo da Configuração ---"
    echo "Domínio: $DOMAIN"
    echo "Email SSL: $SSL_EMAIL"
    echo "Banco: $DB_NAME"
    echo "Usuário DB: $DB_USER"
    echo "Porta: $APP_PORT"
    echo "Pasta: $INSTALL_DIR"
    echo ""
    
    read -p "Continuar com esta configuração? (y/N): " CONFIRM
    if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
        error "Instalação cancelada pelo usuário."
    fi
}

# Atualizar sistema
update_system() {
    log "Atualizando sistema..."
    sudo apt update && sudo apt upgrade -y
    sudo apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release
}

# Instalar Node.js
install_nodejs() {
    log "Instalando Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    
    # Verificar instalação
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    log "Node.js instalado: $NODE_VERSION"
    log "npm instalado: $NPM_VERSION"
}

# Instalar PostgreSQL
install_postgresql() {
    log "Instalando PostgreSQL..."
    sudo apt install -y postgresql postgresql-contrib
    
    # Iniciar serviço
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
    
    log "Configurando banco de dados..."
    
    # Criar usuário e banco
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
    sudo -u postgres psql -c "ALTER USER $DB_USER CREATEDB;"
    
    log "PostgreSQL configurado com sucesso!"
}

# Instalar Nginx
install_nginx() {
    log "Instalando Nginx..."
    sudo apt install -y nginx
    
    # Iniciar serviços
    sudo systemctl start nginx
    sudo systemctl enable nginx
    
    log "Nginx instalado e iniciado!"
}

# Instalar Certbot para SSL
install_certbot() {
    log "Instalando Certbot para SSL..."
    sudo apt install -y certbot python3-certbot-nginx
}

# Clonar e configurar aplicação
setup_application() {
    log "Configurando aplicação LigAI..."
    
    # Criar diretório
    mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    
    # Se já existe, fazer backup
    if [[ -d ".git" ]]; then
        warn "Diretório já contém uma instalação. Fazendo backup..."
        cp -r . "../ligai_backup_$(date +%Y%m%d_%H%M%S)"
        git pull
    else
        # Aqui você colocaria o comando para clonar seu repositório
        # Por enquanto, vamos simular a estrutura
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
    chown -R $USER:$USER "$INSTALL_DIR"
    chmod 600 .env
    
    log "Aplicação configurada!"
}

# Configurar Nginx
configure_nginx() {
    log "Configurando Nginx..."
    
    # Criar configuração do site
    sudo tee /etc/nginx/sites-available/$DOMAIN > /dev/null << EOF
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
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Configuração de segurança
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Limite de upload
    client_max_body_size 50M;
}
EOF
    
    # Habilitar site
    sudo ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
    
    # Remover configuração padrão
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Testar configuração
    sudo nginx -t
    
    # Recarregar Nginx
    sudo systemctl reload nginx
    
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
        warn "Configure o DNS primeiro e execute novamente: sudo certbot --nginx -d $DOMAIN"
        return
    fi
    
    # Obter certificado SSL
    sudo certbot --nginx -d $DOMAIN --email $SSL_EMAIL --agree-tos --non-interactive --redirect
    
    # Configurar renovação automática
    sudo systemctl enable certbot.timer
    
    log "SSL configurado com sucesso!"
}

# Criar serviço systemd
create_service() {
    log "Criando serviço systemd..."
    
    sudo tee /etc/systemd/system/ligai.service > /dev/null << EOF
[Unit]
Description=LigAI Dashboard
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=ligai

# Configurações de segurança
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$INSTALL_DIR

[Install]
WantedBy=multi-user.target
EOF
    
    # Recarregar systemd
    sudo systemctl daemon-reload
    
    # Habilitar serviço
    sudo systemctl enable ligai
    
    log "Serviço systemd criado!"
}

# Configurar firewall
configure_firewall() {
    log "Configurando firewall..."
    
    # Instalar ufw se não estiver instalado
    sudo apt install -y ufw
    
    # Configurar regras básicas
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    
    # Permitir SSH
    sudo ufw allow ssh
    
    # Permitir HTTP e HTTPS
    sudo ufw allow 'Nginx Full'
    
    # Habilitar firewall
    sudo ufw --force enable
    
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

# Criar usuário admin inicial
create_admin_user() {
    log "Configurando usuário administrador..."
    
    echo ""
    echo "--- Configuração do Usuário Administrador ---"
    read -p "Email do administrador: " ADMIN_EMAIL
    
    while true; do
        read -s -p "Senha do administrador: " ADMIN_PASSWORD
        echo
        if [[ -z "$ADMIN_PASSWORD" ]]; then
            warn "Senha não pode estar vazia!"
            continue
        fi
        read -s -p "Confirme a senha: " ADMIN_PASSWORD_CONFIRM
        echo
        if [[ "$ADMIN_PASSWORD" == "$ADMIN_PASSWORD_CONFIRM" ]]; then
            break
        else
            warn "Senhas não coincidem!"
        fi
    done
    
    # Salvar informações em arquivo temporário para script de criação
    cat > "$INSTALL_DIR/create_admin.sql" << EOF
-- Script para criar usuário administrador
INSERT INTO users (username, email, password_hash, role, created_at, updated_at)
VALUES ('admin', '$ADMIN_EMAIL', '$ADMIN_PASSWORD', 'admin', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;
EOF
    
    warn "Execute o script SQL em $INSTALL_DIR/create_admin.sql após iniciar a aplicação"
    warn "ou configure o usuário através da interface web."
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
    sudo systemctl start ligai
    
    # Verificar status
    sleep 5
    if sudo systemctl is-active --quiet ligai; then
        log "Aplicação iniciada com sucesso!"
    else
        error "Falha ao iniciar aplicação. Verifique: sudo journalctl -u ligai -f"
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
    echo "📧 Email do administrador: $ADMIN_EMAIL"
    echo "🗄️  Banco de dados: $DB_NAME"
    echo "📁 Pasta da aplicação: $INSTALL_DIR"
    echo ""
    echo "--- Comandos Úteis ---"
    echo "• Status da aplicação:    sudo systemctl status ligai"
    echo "• Logs da aplicação:      sudo journalctl -u ligai -f"
    echo "• Reiniciar aplicação:    sudo systemctl restart ligai"
    echo "• Parar aplicação:        sudo systemctl stop ligai"
    echo "• Status do Nginx:        sudo systemctl status nginx"
    echo "• Renovar SSL:            sudo certbot renew"
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
    echo "🚀 LigAI Dashboard - Instalador Automático"
    echo "=========================================="
    echo ""
    
    check_root
    check_os
    collect_info
    
    log "Iniciando instalação..."
    
    update_system
    install_nodejs
    install_postgresql
    install_nginx
    install_certbot
    configure_firewall
    setup_application
    configure_nginx
    configure_ssl
    create_service
    run_migrations
    create_admin_user
    start_application
    show_final_info
    
    log "Instalação concluída com sucesso! 🎉"
}

# Executar função principal
main "$@"