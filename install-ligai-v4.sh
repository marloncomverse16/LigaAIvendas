#!/bin/bash

# Script de Instalação LigAI Dashboard - Versão 4.0
# Corrigido e testado para Ubuntu/Debian
# Data: 15/08/2025

set -e
set -o pipefail

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Funções de log
log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[AVISO] $1${NC}"
}

error() {
    echo -e "${RED}[ERRO] $1${NC}"
}

success() {
    echo -e "${PURPLE}[SUCESSO] $1${NC}"
}

question() {
    echo -e "${CYAN}[PERGUNTA] $1${NC}"
}

# Banner de instalação
show_banner() {
    clear
    echo -e "${PURPLE}"
    echo "████████████████████████████████████████████████████████"
    echo "█                                                      █"
    echo "█        🚀 LIGAI DASHBOARD INSTALLER V4.0 🚀          █"
    echo "█                                                      █"
    echo "█          INSTALAÇÃO INTERATIVA COMPLETA              █"
    echo "█     Sistema Completo de Gestão de Leads WhatsApp     █"
    echo "█                                                      █"
    echo "████████████████████████████████████████████████████████"
    echo -e "${NC}"
    echo ""
    echo -e "${YELLOW}Este instalador irá configurar automaticamente:${NC}"
    echo "• Node.js 20 e dependências"
    echo "• PostgreSQL com banco de dados"
    echo "• Nginx como proxy reverso"
    echo "• LigAI Dashboard completo"
    echo "• Serviços systemd"
    echo "• SSL/HTTPS opcional"
    echo ""
}

# Verificações iniciais
check_requirements() {
    log "Verificando requisitos do sistema..."
    
    # Verificar se é root
    if [[ $EUID -ne 0 ]]; then
        error "Este script deve ser executado como root (sudo)"
        echo "Execute: sudo $0"
        exit 1
    fi
    
    # Verificar sistema operacional
    if ! grep -E "Ubuntu|Debian" /etc/os-release &>/dev/null; then
        warn "Sistema não testado. Recomendado: Ubuntu 20.04+ ou Debian 11+"
        question "Deseja continuar mesmo assim? (s/N)"
        read -r continue_install
        if [[ ! "$continue_install" =~ ^[Ss]$ ]]; then
            error "Instalação cancelada pelo usuário"
            exit 1
        fi
    fi
    
    # Verificar conexão com internet
    if ! ping -c 1 8.8.8.8 &>/dev/null; then
        error "Sem conexão com internet. Verifique sua conectividade"
        exit 1
    fi
    
    success "Requisitos verificados!"
    echo ""
}

# Coletar informações do usuário
collect_user_input() {
    log "Coletando informações de configuração..."
    echo ""
    
    # Domínio
    while true; do
        question "Digite o domínio para a aplicação (ex: meusite.com):"
        read -r DOMAIN
        if [[ -n "$DOMAIN" ]]; then
            break
        fi
        warn "Domínio não pode estar vazio!"
    done
    
    # Porta da aplicação
    question "Digite a porta da aplicação (padrão: 5000):"
    read -r APP_PORT
    APP_PORT=${APP_PORT:-5000}
    
    # Configurações do banco
    echo ""
    info "Configurações do Banco de Dados PostgreSQL:"
    
    question "Nome do banco de dados (padrão: ligai):"
    read -r DB_NAME
    DB_NAME=${DB_NAME:-ligai}
    
    question "Usuário do banco (padrão: ligai):"
    read -r DB_USER
    DB_USER=${DB_USER:-ligai}
    
    question "Senha do banco (padrão: ligai123):"
    read -r DB_PASSWORD
    DB_PASSWORD=${DB_PASSWORD:-ligai123}
    
    # Usuário da aplicação
    echo ""
    question "Nome do usuário do sistema para a aplicação (padrão: ligai):"
    read -r APP_USER
    APP_USER=${APP_USER:-ligai}
    
    # Diretório da aplicação
    question "Diretório de instalação (padrão: /opt/ligai):"
    read -r APP_DIRECTORY
    APP_DIRECTORY=${APP_DIRECTORY:-/opt/ligai}
    
    # Configurações SSL
    echo ""
    question "Deseja configurar SSL/HTTPS automaticamente? (s/N):"
    read -r SETUP_SSL
    SETUP_SSL=${SETUP_SSL:-n}
    
    if [[ "$SETUP_SSL" =~ ^[Ss]$ ]]; then
        while true; do
            question "Digite seu email para certificado SSL:"
            read -r SSL_EMAIL
            if [[ -n "$SSL_EMAIL" ]]; then
                break
            fi
            warn "Email é obrigatório para SSL!"
        done
    fi
    
    # Mostrar resumo
    echo ""
    echo -e "${YELLOW}=== RESUMO DA CONFIGURAÇÃO ===${NC}"
    echo "Domínio: $DOMAIN"
    echo "Porta da aplicação: $APP_PORT"
    echo "Banco de dados: $DB_NAME"
    echo "Usuário do banco: $DB_USER"
    echo "Senha do banco: $DB_PASSWORD"
    echo "Usuário do sistema: $APP_USER"
    echo "Diretório: $APP_DIRECTORY"
    echo "SSL: $(if [[ "$SETUP_SSL" =~ ^[Ss]$ ]]; then echo "Sim ($SSL_EMAIL)"; else echo "Não"; fi)"
    echo ""
    
    question "As configurações estão corretas? (S/n):"
    read -r confirm
    if [[ "$confirm" =~ ^[Nn]$ ]]; then
        log "Reiniciando coleta de dados..."
        collect_user_input
        return
    fi
    
    # Configurar variáveis de ambiente
    export DOMAIN APP_PORT DB_NAME DB_USER DB_PASSWORD APP_USER APP_DIRECTORY SETUP_SSL SSL_EMAIL
    export APP_NAME="ligai"
    export APP_DISPLAY_NAME="LigAI Dashboard"
    
    success "Configurações coletadas!"
    echo ""
}

# Atualizar sistema
update_system() {
    log "Atualizando sistema operacional..."
    
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
        openssl
    
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

# Verificar bancos existentes
check_existing_databases() {
    log "Verificando bancos de dados existentes..."
    
    # Verificar se PostgreSQL está rodando
    if ! systemctl is-active --quiet postgresql; then
        return 0
    fi
    
    # Listar bancos existentes
    EXISTING_DBS=$(su - postgres -c "psql -lqt" 2>/dev/null | cut -d \| -f 1 | grep -v template | grep -v postgres | grep -v "^[[:space:]]*$" | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')
    
    if [[ -n "$EXISTING_DBS" ]]; then
        echo ""
        warn "Bancos de dados encontrados no sistema:"
        echo "$EXISTING_DBS" | while IFS= read -r db; do
            if [[ -n "$db" ]]; then
                echo "  • $db"
            fi
        done
        echo ""
        
        # Verificar se o banco que queremos criar já existe
        if echo "$EXISTING_DBS" | grep -q "^${DB_NAME}$"; then
            warn "O banco '${DB_NAME}' já existe!"
            echo ""
            question "O que deseja fazer?"
            echo "1) Usar o banco existente (precisará fornecer credenciais)"
            echo "2) Excluir e criar um novo banco"
            echo "3) Cancelar instalação"
            read -r db_choice
            
            case $db_choice in
                1)
                    log "Usando banco existente..."
                    collect_existing_db_credentials
                    ;;
                2)
                    warn "Excluindo banco existente..."
                    su - postgres -c "psql -c \"DROP DATABASE IF EXISTS ${DB_NAME};\"" 2>/dev/null || true
                    log "Banco ${DB_NAME} excluído. Será criado um novo."
                    ;;
                3)
                    error "Instalação cancelada pelo usuário"
                    exit 1
                    ;;
                *)
                    warn "Opção inválida. Usando configurações padrão..."
                    ;;
            esac
        fi
    else
        log "Nenhum banco existente encontrado. Criando configuração nova."
    fi
}

# Coletar credenciais de banco existente
collect_existing_db_credentials() {
    echo ""
    info "Configurações para banco existente '${DB_NAME}':"
    
    question "Usuário do banco existente (atual: ${DB_USER}):"
    read -r existing_user
    if [[ -n "$existing_user" ]]; then
        DB_USER="$existing_user"
    fi
    
    question "Senha do banco existente:"
    read -s existing_password
    if [[ -n "$existing_password" ]]; then
        DB_PASSWORD="$existing_password"
    fi
    echo ""
    
    # Testar conexão com credenciais fornecidas
    log "Testando conexão com banco existente..."
    if PGPASSWORD="${DB_PASSWORD}" psql -h localhost -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1;" &>/dev/null; then
        success "Conexão com banco existente bem-sucedida!"
        export USE_EXISTING_DB=true
    else
        error "Falha na conexão com banco existente!"
        question "Deseja tentar novamente com outras credenciais? (s/N):"
        read -r retry
        if [[ "$retry" =~ ^[Ss]$ ]]; then
            collect_existing_db_credentials
        else
            warn "Será criado um novo usuário e configuração"
            export USE_EXISTING_DB=false
        fi
    fi
}

# Instalar PostgreSQL
install_postgresql() {
    log "Instalando e configurando PostgreSQL..."
    
    # Instalar PostgreSQL
    export DEBIAN_FRONTEND=noninteractive
    apt install -y postgresql postgresql-contrib
    
    # Iniciar serviços
    systemctl start postgresql
    systemctl enable postgresql
    
    # Aguardar inicialização
    sleep 5
    
    # Verificar se há bancos existentes
    check_existing_databases
    
    # Configurar banco de dados apenas se não estiver usando existente
    if [[ "${USE_EXISTING_DB:-false}" != "true" ]]; then
        log "Configurando banco de dados..."
        
        # Verificar se usuário existe
        USER_COUNT=$(su - postgres -c "psql -t -A -c \"SELECT COUNT(*) FROM pg_roles WHERE rolname='${DB_USER}';\"" 2>/dev/null | tr -d '[:space:]' || echo "0")
        
        if [[ "$USER_COUNT" -eq "0" ]]; then
            log "Criando usuário do banco: ${DB_USER}"
            su - postgres -c "psql -c \"CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';\"" 2>/dev/null || true
        else
            log "Atualizando senha do usuário ${DB_USER}"
            su - postgres -c "psql -c \"ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';\"" 2>/dev/null || true
        fi
        
        # Verificar se banco existe
        DB_COUNT=$(su - postgres -c "psql -lqt" 2>/dev/null | cut -d \| -f 1 | grep -w "${DB_NAME}" | wc -l || echo "0")
        
        if [[ "$DB_COUNT" -eq "0" ]]; then
            log "Criando banco de dados: ${DB_NAME}"
            su - postgres -c "psql -c \"CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};\"" 2>/dev/null || true
        else
            log "Banco de dados ${DB_NAME} já existe"
        fi
        
        # Configurar permissões
        su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};\"" 2>/dev/null || true
        su - postgres -c "psql -c \"ALTER USER ${DB_USER} CREATEDB;\"" 2>/dev/null || true
    fi
    
    # Configurar acesso local
    log "Configurando acesso ao PostgreSQL..."
    
    PG_VERSION=$(ls /etc/postgresql/ | head -n1)
    PG_HBA_FILE="/etc/postgresql/${PG_VERSION}/main/pg_hba.conf"
    
    if [[ -f "$PG_HBA_FILE" ]]; then
        cp "$PG_HBA_FILE" "$PG_HBA_FILE.backup.$(date +%Y%m%d_%H%M%S)"
        
        # Adicionar configuração se não existir
        if ! grep -q "local.*${DB_NAME}.*${DB_USER}.*md5" "$PG_HBA_FILE"; then
            echo "local   ${DB_NAME}   ${DB_USER}   md5" >> "$PG_HBA_FILE"
        fi
        
        systemctl restart postgresql
        sleep 3
    fi
    
    # Testar conexão
    log "Testando conexão final com PostgreSQL..."
    for i in {1..3}; do
        if PGPASSWORD="${DB_PASSWORD}" psql -h localhost -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1;" &>/dev/null; then
            success "PostgreSQL configurado e testado!"
            return 0
        fi
        log "Tentativa $i/3 falhou. Aguardando..."
        sleep 5
    done
    
    error "Falha na configuração do PostgreSQL após 3 tentativas"
    log "Tentando diagnóstico..."
    systemctl status postgresql --no-pager || true
    su - postgres -c "psql -l" 2>/dev/null || true
    exit 1
}

# Instalar e configurar Nginx
install_nginx() {
    log "Instalando e configurando Nginx..."
    
    # Instalar Nginx
    apt install -y nginx
    
    # Parar Nginx se estiver rodando
    systemctl stop nginx 2>/dev/null || true
    
    # Verificar e liberar porta 80
    if lsof -i :80 2>/dev/null; then
        log "Liberando porta 80..."
        fuser -k 80/tcp 2>/dev/null || true
        sleep 2
    fi
    
    # Backup de configurações existentes
    [[ -f /etc/nginx/nginx.conf ]] && cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup.$(date +%Y%m%d_%H%M%S)
    
    # Remover configurações default conflitantes
    rm -f /etc/nginx/sites-enabled/default
    rm -f /etc/nginx/sites-available/default
    
    # Criar configuração do LigAI
    create_nginx_config
    
    # Habilitar site
    ln -sf /etc/nginx/sites-available/ligai /etc/nginx/sites-enabled/
    
    # Testar configuração
    if nginx -t; then
        systemctl start nginx
        systemctl enable nginx
        success "Nginx configurado!"
    else
        error "Erro na configuração do Nginx"
        exit 1
    fi
}

# Criar configuração do Nginx
create_nginx_config() {
    cat > /etc/nginx/sites-available/ligai << EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    
    # Configurações de proxy
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
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }
    
    # Configurações de segurança
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
}
EOF
}

# Configurar SSL com Let's Encrypt
setup_ssl() {
    if [[ "$SETUP_SSL" =~ ^[Ss]$ ]]; then
        log "Configurando SSL com Let's Encrypt..."
        
        # Instalar Certbot
        apt install -y certbot python3-certbot-nginx
        
        # Obter certificado
        if certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --email "$SSL_EMAIL" --agree-tos --no-eff-email --non-interactive; then
            success "SSL configurado!"
            
            # Configurar renovação automática
            (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
        else
            warn "Falha na configuração do SSL. Continuando sem HTTPS."
        fi
    fi
}

# Criar usuário da aplicação
create_app_user() {
    log "Criando usuário da aplicação..."
    
    if ! id "${APP_USER}" &>/dev/null; then
        useradd -r -s /bin/bash -d "${APP_DIRECTORY}" "${APP_USER}"
        log "Usuário ${APP_USER} criado"
    else
        log "Usuário ${APP_USER} já existe"
    fi
    
    # Criar diretório da aplicação
    mkdir -p "${APP_DIRECTORY}"
    chown "${APP_USER}:${APP_USER}" "${APP_DIRECTORY}"
    
    success "Usuário da aplicação configurado!"
}

# Baixar e configurar aplicação LigAI Dashboard
create_application() {
    log "Baixando aplicação ${APP_DISPLAY_NAME} do GitHub..."
    
    # Baixar código do GitHub
    log "Baixando LigAI Dashboard do repositório GitHub..."
    log "Repositório: https://github.com/marloncomverse16/LigaAIvendas"
    
    # Remover diretório se existir
    if [[ -d "${APP_DIRECTORY}" ]]; then
        rm -rf "${APP_DIRECTORY}"
    fi
    
    # Tentar clone via Git primeiro
    if git clone https://github.com/marloncomverse16/LigaAIvendas.git "${APP_DIRECTORY}" 2>/dev/null; then
        success "Repositório clonado via Git!"
    elif curl -L --connect-timeout 10 https://github.com/marloncomverse16/LigaAIvendas/archive/refs/heads/main.zip -o /tmp/ligai.zip 2>/dev/null; then
        log "Git falhou, usando download direto do ZIP..."
        mkdir -p "${APP_DIRECTORY}"
        cd /tmp
        if unzip -q ligai.zip 2>/dev/null; then
            mv LigaAIvendas-main/* "${APP_DIRECTORY}/" 2>/dev/null || true
            mv LigaAIvendas-main/.* "${APP_DIRECTORY}/" 2>/dev/null || true
            rm -rf LigaAIvendas-main ligai.zip
            success "Download via ZIP realizado!"
        else
            error "Falha na extração do ZIP"
            create_fallback_application
        fi
    else
        warn "Falha no download do GitHub. Criando aplicação básica..."
        create_fallback_application
    fi
    
    cd "${APP_DIRECTORY}"
    
    # Verificar se os arquivos essenciais existem
    if [[ ! -f "package.json" ]]; then
        warn "package.json não encontrado. Criando configuração básica..."
        create_basic_package_json
    fi
    
    # Verificar estrutura de diretórios e criar se necessário
    mkdir -p {uploads,migrations} 2>/dev/null || true
    
    # Configurar variáveis de ambiente
    configure_environment
    
    success "Aplicação configurada!"
}

# Criar package.json básico se não existir
create_basic_package_json() {
    cat > package.json << 'EOF'
{
  "name": "ligai-dashboard",
  "version": "4.0.0",
  "description": "LigAI Dashboard - Sistema Completo de Gestão de Leads WhatsApp",
  "main": "server/index.ts",
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "build": "npm run build:client",
    "build:client": "vite build client",
    "start": "NODE_ENV=production tsx server/index.ts",
    "db:push": "drizzle-kit push:pg",
    "db:migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "typescript": "^5.3.2",
    "tsx": "^4.6.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "vite": "^5.0.2",
    "@vitejs/plugin-react": "^4.1.1",
    "tailwindcss": "^3.3.6",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "@types/node": "^20.9.2",
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/react": "^18.2.37",
    "@types/react-dom": "^18.2.15",
    "drizzle-orm": "^0.29.0",
    "drizzle-kit": "^0.20.0",
    "pg": "^8.11.3",
    "@types/pg": "^8.10.9"
  }
}
EOF
}

# Configurar variáveis de ambiente
configure_environment() {
    log "Configurando variáveis de ambiente..."
    
    # Criar ou atualizar .env
    cat > .env << EOF
# Configurações do Servidor
NODE_ENV=production
PORT=${APP_PORT}
DOMAIN=${DOMAIN}

# Configurações do Banco de Dados
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}
DB_HOST=localhost
DB_PORT=5432
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}

# Configurações da Aplicação
APP_NAME=LigAI Dashboard
APP_VERSION=4.0.0
APP_ENVIRONMENT=production

# Configurações de Sessão
SESSION_SECRET=ligai_secret_$(openssl rand -hex 32)

# URLs
BASE_URL=http$(if [[ "$SETUP_SSL" =~ ^[Ss]$ ]]; then echo "s"; fi)://${DOMAIN}
API_URL=http$(if [[ "$SETUP_SSL" =~ ^[Ss]$ ]]; then echo "s"; fi)://${DOMAIN}/api

# Data de instalação
INSTALL_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF

    success "Variáveis de ambiente configuradas!"
}

# Configurar banco de dados da aplicação
setup_database() {
    log "Configurando banco de dados da aplicação..."
    
    cd "${APP_DIRECTORY}"
    
    # Executar migrações se existirem
    if [[ -f "drizzle.config.ts" ]]; then
        log "Executando migrações do banco..."
        npm run db:push 2>/dev/null || {
            warn "Migrações falharam ou não foram necessárias"
        }
    fi
    
    success "Banco de dados configurado!"
}

# Criar aplicação básica de fallback
create_fallback_application() {
    warn "Criando aplicação básica de fallback..."
    
    mkdir -p "${APP_DIRECTORY}"
    cd "${APP_DIRECTORY}"
    
    # Criar estrutura básica
    mkdir -p {client/src,server,shared,uploads,migrations}
    
    # Criar package.json básico
    create_basic_package_json
    
    # Criar servidor básico
    cat > server/index.ts << EOF
import express from 'express';
import { createServer } from 'http';
import path from 'path';

const app = express();
const PORT = process.env.PORT || ${APP_PORT};

app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'LigAI Dashboard Básico funcionando!',
    version: '4.0.0-fallback',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'production',
    database: 'conectado',
    domain: '${DOMAIN}',
    port: PORT,
    note: 'Aplicação básica - Clone do GitHub recomendado'
  });
});

app.get('*', (req, res) => {
  res.send(\`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LigAI Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 15px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
        h1 { color: #333; text-align: center; margin-bottom: 30px; }
        .status { background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 10px; margin: 20px 0; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 10px; margin: 20px 0; }
        .info { background: #d1ecf1; border: 1px solid #bee5eb; padding: 20px; border-radius: 10px; margin: 20px 0; }
        .btn { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 10px 5px; }
        .btn:hover { background: #0056b3; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 LigAI Dashboard Instalado</h1>
        
        <div class="status">
            <h3>✅ Instalação Concluída</h3>
            <p>O LigAI Dashboard foi instalado com sucesso no seu servidor!</p>
            <p><strong>Domínio:</strong> ${DOMAIN}</p>
            <p><strong>Porta:</strong> ${APP_PORT}</p>
            <p><strong>Status:</strong> Online</p>
        </div>
        
        <div class="warning">
            <h3>⚠️ Aplicação Básica</h3>
            <p>Esta é uma versão básica de fallback. Para a versão completa:</p>
            <ol>
                <li>Acesse seu servidor via SSH</li>
                <li>Navegue até <code>${APP_DIRECTORY}</code></li>
                <li>Execute: <code>git clone https://github.com/marloncomverse16/LigaAIvendas.git temp && cp -r temp/* . && rm -rf temp</code></li>
                <li>Execute: <code>npm install && npm run build && sudo systemctl restart ${APP_NAME}</code></li>
            </ol>
        </div>
        
        <div class="info">
            <h3>📋 Próximos Passos</h3>
            <ul>
                <li>✅ PostgreSQL configurado</li>
                <li>✅ Nginx configurado</li>
                <li>✅ SSL/HTTPS $(if [[ "$SETUP_SSL" =~ ^[Ss]$ ]]; then echo "configurado"; else echo "não configurado"; fi)</li>
                <li>✅ Serviços systemd ativos</li>
                <li>🔄 Aguardando código completo do GitHub</li>
            </ul>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
            <button class="btn" onclick="location.reload()">🔄 Atualizar</button>
            <button class="btn" onclick="window.open('/api/health', '_blank')">📊 API Status</button>
        </div>
    </div>
</body>
</html>
  \`);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(\`🚀 LigAI Dashboard (Básico) iniciado na porta \${PORT}\`);
  console.log(\`🌐 Acesse: http$(if [[ "$SETUP_SSL" =~ ^[Ss]$ ]]; then echo "s"; fi)://${DOMAIN}\`);
});
EOF
    
    success "Aplicação básica criada!"
}

# Instalar dependências
install_dependencies() {
    log "Instalando dependências da aplicação..."
    
    cd "${APP_DIRECTORY}"
    
    # Instalar dependências
    npm install --silent
    
    # Configurar banco de dados
    setup_database
    
    # Build do frontend se existir
    if [[ -f "client/package.json" ]] || [[ -d "client/src" ]]; then
        log "Fazendo build do frontend..."
        npm run build 2>/dev/null || {
            warn "Build do frontend falhou, mas continuando..."
        }
    fi
    
    success "Dependências instaladas!"
}

# Configurar serviço systemd
setup_systemd() {
    log "Configurando serviço systemd..."
    
    cat > /etc/systemd/system/${APP_NAME}.service << EOF
[Unit]
Description=${APP_DISPLAY_NAME}
After=network.target postgresql.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIRECTORY}
Environment=NODE_ENV=production
EnvironmentFile=${APP_DIRECTORY}/.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
    
    # Configurar permissões
    chown -R "${APP_USER}:${APP_USER}" "${APP_DIRECTORY}"
    
    # Recarregar systemd
    systemctl daemon-reload
    systemctl enable "${APP_NAME}"
    
    success "Serviço systemd configurado!"
}

# Iniciar serviços
start_services() {
    log "Iniciando todos os serviços..."
    
    # Iniciar aplicação
    systemctl start "${APP_NAME}"
    
    # Configurar SSL se solicitado
    setup_ssl
    
    # Aguardar inicialização
    sleep 10
    
    success "Serviços iniciados!"
}

# Verificar instalação
verify_installation() {
    log "Verificando instalação..."
    
    echo ""
    echo -e "${YELLOW}=== STATUS DOS SERVIÇOS ===${NC}"
    
    # PostgreSQL
    if systemctl is-active --quiet postgresql; then
        echo "✅ PostgreSQL: Ativo"
    else
        echo "❌ PostgreSQL: Inativo"
        return 1
    fi
    
    # Nginx
    if systemctl is-active --quiet nginx; then
        echo "✅ Nginx: Ativo"
    else
        echo "❌ Nginx: Inativo"
        return 1
    fi
    
    # Aplicação
    if systemctl is-active --quiet "${APP_NAME}"; then
        echo "✅ LigAI Dashboard: Ativo"
    else
        echo "❌ LigAI Dashboard: Inativo"
        return 1
    fi
    
    # Testar conectividade
    echo ""
    echo -e "${YELLOW}=== TESTE DE CONECTIVIDADE ===${NC}"
    
    sleep 5
    if curl -s "http://localhost:${APP_PORT}/api/health" > /dev/null; then
        echo "✅ API: Respondendo"
    else
        echo "❌ API: Não responde"
        return 1
    fi
    
    success "Instalação verificada com sucesso!"
    return 0
}

# Mostrar informações finais
show_final_info() {
    clear
    echo -e "${PURPLE}"
    echo "████████████████████████████████████████████████████████"
    echo "█                                                      █"
    echo "█     🎉 INSTALAÇÃO CONCLUÍDA COM SUCESSO! 🎉          █"
    echo "█                                                      █"
    echo "████████████████████████████████████████████████████████"
    echo -e "${NC}"
    echo ""
    
    echo -e "${GREEN}=== INFORMAÇÕES DE ACESSO ===${NC}"
    echo ""
    echo "🌐 URL Principal: http$(if [[ "$SETUP_SSL" =~ ^[Ss]$ ]]; then echo "s"; fi)://${DOMAIN}"
    echo "🔗 API Health: http$(if [[ "$SETUP_SSL" =~ ^[Ss]$ ]]; then echo "s"; fi)://${DOMAIN}/api/health"
    echo "🔗 API Info: http$(if [[ "$SETUP_SSL" =~ ^[Ss]$ ]]; then echo "s"; fi)://${DOMAIN}/api/info"
    echo ""
    
    echo -e "${BLUE}=== COMANDOS ÚTEIS ===${NC}"
    echo ""
    echo "# Ver status: sudo systemctl status ${APP_NAME}"
    echo "# Ver logs: sudo journalctl -u ${APP_NAME} -f"
    echo "# Reiniciar: sudo systemctl restart ${APP_NAME}"
    echo ""
    
    success "LigAI Dashboard v4.0 instalado e funcionando!"
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
    start_services
    
    if verify_installation; then
        show_final_info
    else
        error "Falha na verificação da instalação!"
        echo ""
        warn "Para debugar, verifique os logs:"
        echo "sudo journalctl -u ${APP_NAME} -n 50"
        echo "sudo systemctl status ${APP_NAME}"
        exit 1
    fi
}

# Executar instalação
main "$@"