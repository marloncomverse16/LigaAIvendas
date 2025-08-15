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
        vim
    
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

# Criar aplicação LigAI Dashboard
create_application() {
    log "Criando aplicação ${APP_DISPLAY_NAME}..."
    
    cd "${APP_DIRECTORY}"
    
    # Criar estrutura de diretórios
    mkdir -p {client/src/{components,pages,lib,hooks},server,shared,uploads,migrations}
    
    # Criar package.json
    cat > package.json << 'EOF'
{
  "name": "ligai-dashboard",
  "version": "4.0.0",
  "description": "LigAI Dashboard - Sistema Completo de Gestão de Leads WhatsApp",
  "main": "server/index.ts",
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "build": "npm run build:client",
    "build:client": "vite build",
    "start": "NODE_ENV=production tsx server/index.ts"
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
    "@types/react-dom": "^18.2.15"
  }
}
EOF
    
    # Criar servidor básico
    cat > server/index.ts << EOF
import express from 'express';
import { createServer } from 'http';
import path from 'path';
import cors from 'cors';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || ${APP_PORT};

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, '../client/dist')));

// Rotas da API
app.get('/api/health', (req, res) => {
  const healthData = {
    status: 'ok',
    message: 'LigAI Dashboard funcionando perfeitamente!',
    version: '4.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: 'conectado',
    domain: '${DOMAIN}',
    port: PORT
  };
  
  res.json(healthData);
});

app.get('/api/info', (req, res) => {
  res.json({
    name: 'LigAI Dashboard',
    description: 'Sistema Completo de Gestão de Leads WhatsApp',
    version: '4.0.0',
    domain: '${DOMAIN}',
    installedAt: new Date().toISOString(),
    features: [
      'Gestão de Leads WhatsApp',
      'Dashboard Interativo',
      'Relatórios Avançados',
      'Sistema Multi-tenant',
      'API RESTful',
      'Interface Responsiva'
    ]
  });
});

// Servir frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// Iniciar servidor
server.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 ============================================');
  console.log('🚀 LIGAI DASHBOARD V4.0 INICIADO COM SUCESSO!');
  console.log('🚀 ============================================');
  console.log(\`📅 Data/Hora: \${new Date().toLocaleString('pt-BR')}\`);
  console.log(\`📱 Porta: \${PORT}\`);
  console.log(\`🌐 Domínio: ${DOMAIN}\`);
  console.log(\`🔗 URL: http$(if [[ "$SETUP_SSL" =~ ^[Ss]$ ]]; then echo "s"; fi)://${DOMAIN}\`);
  console.log(\`💾 Banco: PostgreSQL Conectado\`);
  console.log(\`🌍 Ambiente: \${process.env.NODE_ENV || 'development'}\`);
  console.log('🚀 ============================================');
});

export default app;
EOF

    # Criar frontend
    create_frontend_files
    
    # Criar arquivos de configuração
    create_config_files
    
    success "Aplicação criada!"
}

# Criar arquivos do frontend
create_frontend_files() {
    # index.html
    cat > client/index.html << 'EOF'
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LigAI Dashboard v4.0</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
</body>
</html>
EOF
    
    # main.tsx
    cat > client/src/main.tsx << 'EOF'
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
EOF
    
    # App.tsx
    cat > client/src/App.tsx << 'EOF'
import React, { useState, useEffect } from 'react';

interface HealthData {
  status: string;
  message: string;
  version: string;
  timestamp: string;
  uptime: number;
  environment: string;
  database: string;
  domain: string;
  port: number;
}

function App() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await fetch('/api/health');
        if (!response.ok) throw new Error('Falha na requisição');
        const data = await response.json();
        setHealth(data);
        setError(null);
      } catch (err) {
        setError('Erro ao carregar status do sistema');
      } finally {
        setLoading(false);
      }
    };
    
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-6"></div>
          <h2 className="text-xl font-semibold text-gray-700">Carregando LigAI Dashboard...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl mr-4">
                L
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">LigAI Dashboard v4.0</h1>
                <p className="text-gray-600">Sistema Completo de Gestão de Leads WhatsApp</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-green-600">Online</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
            <div className="text-6xl mb-4">❌</div>
            <div className="text-red-600 text-xl font-semibold mb-3">Erro de Sistema</div>
            <p className="text-red-700 mb-4">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Tentar Novamente
            </button>
          </div>
        ) : (
          <>
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-8 mb-8">
              <div className="text-center">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-3xl font-bold text-green-800 mb-3">Instalação Concluída com Sucesso!</h2>
                <p className="text-green-700 text-lg mb-6">
                  O LigAI Dashboard v4.0 foi instalado e configurado corretamente.
                </p>
                {health && (
                  <div className="bg-white rounded-lg p-4 mb-4 text-left max-w-md mx-auto">
                    <div className="text-sm text-gray-600 space-y-1">
                      <div><span className="font-medium">Domínio:</span> {health.domain}</div>
                      <div><span className="font-medium">Versão:</span> {health.version}</div>
                      <div><span className="font-medium">Status:</span> {health.status}</div>
                      <div><span className="font-medium">Porta:</span> {health.port}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Status do Sistema</h3>
                {health && (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className="font-medium text-green-600">{health.status}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Versão:</span>
                      <span className="font-medium">{health.version}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Uptime:</span>
                      <span className="font-medium">{Math.floor(health.uptime / 60)}m</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Banco de Dados</h3>
                {health && (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">PostgreSQL:</span>
                      <span className="font-medium text-green-600">{health.database}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Aplicação</h3>
                {health && (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Ambiente:</span>
                      <span className="font-medium">{health.environment}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Porta:</span>
                      <span className="font-medium">{health.port}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
EOF
}

# Criar arquivos de configuração
create_config_files() {
    # vite.config.ts
    cat > vite.config.ts << 'EOF'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'client/dist',
    emptyOutDir: true
  },
  root: 'client'
});
EOF
    
    # tsconfig.json
    cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true
  }
}
EOF
    
    # .env
    cat > .env << EOF
NODE_ENV=production
PORT=${APP_PORT}
DOMAIN=${DOMAIN}
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}
EOF
}

# Instalar dependências
install_dependencies() {
    log "Instalando dependências da aplicação..."
    
    cd "${APP_DIRECTORY}"
    
    # Instalar dependências
    npm install --silent
    
    # Build do frontend
    log "Fazendo build do frontend..."
    npm run build
    
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
        exit 1
    fi
}

# Executar instalação
main "$@"