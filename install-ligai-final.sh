#!/bin/bash

# Script de Instalação Interativa do LigAI Dashboard
# Versão: 3.0 - Instalação Interativa Completa
# Data: 15/08/2025

set -e

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
    echo "█        🚀 LIGAI DASHBOARD INSTALLER 3.0 🚀           █"
    echo "█                                                      █"
    echo "█          INSTALAÇÃO INTERATIVA COMPLETA              █"
    echo "█     Sistema Completo de Gestão de Leads WhatsApp     █"
    echo "█                                                      █"
    echo "████████████████████████████████████████████████████████"
    echo -e "${NC}"
    echo ""
    echo -e "${YELLOW}Este instalador irá configurar automaticamente:${NC}"
    echo "• Node.js e dependências"
    echo "• PostgreSQL com banco de dados"
    echo "• Nginx como proxy reverso"
    echo "• LigAI Dashboard completo"
    echo "• Serviços systemd"
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
    if ! ping -c 1 google.com &>/dev/null; then
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
    question "Digite o domínio para a aplicação (ex: meusite.com):"
    read -r DOMAIN
    while [[ -z "$DOMAIN" ]]; do
        warn "Domínio não pode estar vazio!"
        question "Digite o domínio para a aplicação:"
        read -r DOMAIN
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
        question "Digite seu email para certificado SSL:"
        read -r SSL_EMAIL
        while [[ -z "$SSL_EMAIL" ]]; do
            warn "Email é obrigatório para SSL!"
            question "Digite seu email para certificado SSL:"
            read -r SSL_EMAIL
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
    echo "SSL: $([ "$SETUP_SSL" = "s" ] && echo "Sim ($SSL_EMAIL)" || echo "Não")"
    echo ""
    
    question "As configurações estão corretas? (S/n):"
    read -r confirm
    if [[ "$confirm" =~ ^[Nn]$ ]]; then
        log "Reiniciando coleta de dados..."
        collect_user_input
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
        psmisc
    
    success "Sistema atualizado!"
}

# Instalar Node.js
install_nodejs() {
    log "Instalando Node.js..."
    
    # Remover instalações antigas
    apt remove -y nodejs npm 2>/dev/null || true
    
    # Instalar Node.js 20
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
    
    # Verificar instalação
    NODE_VERSION_INSTALLED=$(node --version)
    NPM_VERSION_INSTALLED=$(npm --version)
    
    log "Node.js instalado: ${NODE_VERSION_INSTALLED}"
    log "npm instalado: ${NPM_VERSION_INSTALLED}"
    
    success "Node.js configurado!"
}

# Instalar PostgreSQL
install_postgresql() {
    log "Instalando e configurando PostgreSQL..."
    
    # Instalar PostgreSQL
    apt install -y postgresql postgresql-contrib
    
    # Iniciar serviços
    systemctl start postgresql
    systemctl enable postgresql
    
    # Aguardar inicialização
    sleep 5
    
    # Configurar banco de dados
    log "Configurando banco de dados..."
    
    # Verificar se usuário existe
    USER_EXISTS=$(su - postgres -c "psql -t -c \"SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'\"" 2>/dev/null | grep -c 1 || echo "0")
    
    if [[ "$USER_EXISTS" -eq "0" ]]; then
        log "Criando usuário do banco: ${DB_USER}"
        su - postgres -c "psql -c \"CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';\""
    else
        log "Atualizando senha do usuário ${DB_USER}"
        su - postgres -c "psql -c \"ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';\""
    fi
    
    # Verificar se banco existe
    DB_EXISTS=$(su - postgres -c "psql -lqt" | cut -d \| -f 1 | grep -wc "${DB_NAME}" || echo "0")
    
    if [[ "$DB_EXISTS" -eq "0" ]]; then
        log "Criando banco de dados: ${DB_NAME}"
        su - postgres -c "psql -c \"CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};\""
    else
        log "Banco de dados ${DB_NAME} já existe"
    fi
    
    # Configurar permissões
    su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};\""
    su - postgres -c "psql -c \"ALTER USER ${DB_USER} CREATEDB;\""
    
    # Configurar acesso local
    log "Configurando acesso ao PostgreSQL..."
    
    PG_VERSION=$(ls /etc/postgresql/ | head -n1)
    PG_HBA_FILE="/etc/postgresql/${PG_VERSION}/main/pg_hba.conf"
    
    if [ -f "$PG_HBA_FILE" ]; then
        cp "$PG_HBA_FILE" "$PG_HBA_FILE.backup.$(date +%Y%m%d_%H%M%S)"
        
        if ! grep -q "local.*${DB_NAME}.*${DB_USER}.*md5" "$PG_HBA_FILE"; then
            echo "local   ${DB_NAME}   ${DB_USER}   md5" >> "$PG_HBA_FILE"
        fi
        
        systemctl restart postgresql
        sleep 3
    fi
    
    # Testar conexão
    if PGPASSWORD="${DB_PASSWORD}" psql -h localhost -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1;" &>/dev/null; then
        success "PostgreSQL configurado e testado!"
    else
        error "Falha na configuração do PostgreSQL"
        log "Tentando diagnóstico..."
        systemctl status postgresql --no-pager
        su - postgres -c "psql -l" || true
        exit 1
    fi
}

# Instalar e configurar Nginx
install_nginx() {
    log "Instalando e configurar Nginx..."
    
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
    [ -f /etc/nginx/nginx.conf ] && cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup.$(date +%Y%m%d_%H%M%S)
    
    # Remover configurações default conflitantes
    rm -f /etc/nginx/sites-enabled/default
    rm -f /etc/nginx/sites-available/default
    
    # Criar configuração do LigAI
    if [[ "$SETUP_SSL" =~ ^[Ss]$ ]]; then
        create_nginx_ssl_config
    else
        create_nginx_http_config
    fi
    
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

# Criar configuração HTTP do Nginx
create_nginx_http_config() {
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

# Criar configuração SSL do Nginx
create_nginx_ssl_config() {
    cat > /etc/nginx/sites-available/ligai << EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${DOMAIN} www.${DOMAIN};
    
    # Certificados SSL (serão configurados pelo Certbot)
    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    
    # Configurações SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
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
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
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
        certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --email "$SSL_EMAIL" --agree-tos --no-eff-email --non-interactive
        
        # Configurar renovação automática
        crontab -l 2>/dev/null | grep -v certbot | { cat; echo "0 12 * * * /usr/bin/certbot renew --quiet"; } | crontab -
        
        success "SSL configurado!"
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
  "version": "3.0.0",
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
    
    # Criar servidor
    create_server_files
    
    # Criar frontend
    create_frontend_files
    
    # Criar arquivos de configuração
    create_config_files
    
    success "Aplicação criada!"
}

# Criar arquivos do servidor
create_server_files() {
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
    version: '3.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: process.env.DATABASE_URL ? 'conectado' : 'configuração pendente',
    domain: '${DOMAIN}',
    port: PORT,
    services: {
      express: 'ativo',
      cors: 'ativo',
      staticFiles: 'ativo'
    }
  };
  
  res.json(healthData);
});

app.get('/api/info', (req, res) => {
  res.json({
    name: 'LigAI Dashboard',
    description: 'Sistema Completo de Gestão de Leads WhatsApp',
    version: '3.0.0',
    domain: '${DOMAIN}',
    installedAt: new Date().toISOString(),
    features: [
      'Gestão de Leads WhatsApp',
      'Dashboard Interativo em Tempo Real',
      'Relatórios e Análises Avançadas',
      'Sistema Multi-tenant',
      'API RESTful Completa',
      'Interface Responsiva',
      'Segurança Avançada'
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
  console.log('🚀 LIGAI DASHBOARD INICIADO COM SUCESSO!');
  console.log('🚀 ============================================');
  console.log(\`📅 Data/Hora: \${new Date().toLocaleString('pt-BR')}\`);
  console.log(\`📱 Porta: \${PORT}\`);
  console.log(\`🌐 Domínio: ${DOMAIN}\`);
  console.log(\`🔗 URL: http${process.env.SSL_ENABLED === 'true' ? 's' : ''}://${DOMAIN}\`);
  console.log(\`💾 Banco: \${process.env.DATABASE_URL ? 'PostgreSQL Conectado' : 'Pendente'}\`);
  console.log(\`🌍 Ambiente: \${process.env.NODE_ENV || 'development'}\`);
  console.log('🚀 ============================================');
});

// Tratamento de erros
process.on('uncaughtException', (error) => {
  console.error('❌ Erro não capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise rejeitada:', promise, 'Razão:', reason);
});

export default app;
EOF
}

# Criar arquivos do frontend
create_frontend_files() {
    # client/index.html
    cat > client/index.html << 'EOF'
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LigAI Dashboard - Gestão de Leads WhatsApp</title>
    <meta name="description" content="Sistema completo de gestão de leads WhatsApp com inteligência artificial">
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚀</text></svg>">
</head>
<body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
</body>
</html>
EOF
    
    # client/src/main.tsx
    cat > client/src/main.tsx << 'EOF'
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
EOF
    
    # client/src/App.tsx - arquivo mais elaborado
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
  services: {
    express: string;
    cors: string;
    staticFiles: string;
  };
}

interface InfoData {
  name: string;
  description: string;
  version: string;
  domain: string;
  installedAt: string;
  features: string[];
}

function App() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [info, setInfo] = useState<InfoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [healthResponse, infoResponse] = await Promise.all([
          fetch('/api/health'),
          fetch('/api/info')
        ]);
        
        if (!healthResponse.ok || !infoResponse.ok) {
          throw new Error('Falha na requisição');
        }
        
        const healthData = await healthResponse.json();
        const infoData = await infoResponse.json();
        
        setHealth(healthData);
        setInfo(infoData);
        setLastUpdate(new Date().toLocaleString('pt-BR'));
        setError(null);
      } catch (err) {
        setError('Erro ao carregar dados do sistema');
        console.error('Erro:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-6"></div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Carregando LigAI Dashboard</h2>
          <p className="text-gray-500">Verificando status do sistema...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl mr-4 shadow-lg">
                L
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">LigAI Dashboard</h1>
                <p className="text-gray-600">Sistema Completo de Gestão de Leads WhatsApp</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-green-600">Sistema Online</span>
              </div>
              {lastUpdate && (
                <div className="text-xs text-gray-500">
                  Última atualização: {lastUpdate}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
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
            {/* Installation Success Banner */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-8 mb-8">
              <div className="text-center">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-3xl font-bold text-green-800 mb-3">Instalação Concluída com Sucesso!</h2>
                <p className="text-green-700 text-lg mb-6">
                  O LigAI Dashboard v3.0 foi instalado e configurado corretamente no seu servidor.
                </p>
                {info && (
                  <div className="bg-white rounded-lg p-4 mb-4 text-left max-w-md mx-auto">
                    <div className="text-sm text-gray-600 space-y-1">
                      <div><span className="font-medium">Domínio:</span> {info.domain}</div>
                      <div><span className="font-medium">Versão:</span> {info.version}</div>
                      <div><span className="font-medium">Instalado em:</span> {new Date(info.installedAt).toLocaleString('pt-BR')}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {/* System Status */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Status do Sistema</h3>
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                </div>
                {health && (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className="font-medium text-green-600 capitalize">{health.status}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Versão:</span>
                      <span className="font-medium">{health.version}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Ambiente:</span>
                      <span className="font-medium capitalize">{health.environment}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Porta:</span>
                      <span className="font-medium">{health.port}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Uptime:</span>
                      <span className="font-medium">{Math.floor(health.uptime / 60)}m {Math.floor(health.uptime % 60)}s</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Database Status */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Banco de Dados</h3>
                  <div className={`w-3 h-3 rounded-full ${health?.database === 'conectado' ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
                </div>
                {health && (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">PostgreSQL:</span>
                      <span className={`font-medium ${health.database === 'conectado' ? 'text-green-600' : 'text-yellow-600'}`}>
                        {health.database}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      Sistema pronto para armazenar e gerenciar dados de leads WhatsApp
                    </div>
                  </div>
                )}
              </div>

              {/* Services Status */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Serviços</h3>
                  <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                </div>
                {health && (
                  <div className="space-y-3">
                    {Object.entries(health.services).map(([service, status]) => (
                      <div key={service} className="flex justify-between">
                        <span className="text-gray-600 capitalize">
                          {service.replace(/([A-Z])/g, ' $1').toLowerCase()}:
                        </span>
                        <span className="font-medium text-green-600 capitalize">{status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Features Grid */}
            {info && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Recursos Disponíveis</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {info.features.map((feature, index) => (
                    <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        
        {/* Footer */}
        <div className="mt-12 text-center text-gray-500 text-sm">
          <p className="mb-2">LigAI Dashboard v3.0 - Sistema Completo de Gestão de Leads WhatsApp</p>
          <p>Instalado em {health ? new Date(health.timestamp).toLocaleString('pt-BR') : 'Carregando...'}</p>
        </div>
      </main>
    </div>
  );
}

export default App;
EOF
    
    # client/src/index.css
    cat > client/src/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* {
  box-sizing: border-box;
}

#root {
  min-height: 100vh;
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: .5;
  }
}
EOF
}

# Criar arquivos de configuração
create_config_files() {
    # vite.config.ts
    cat > vite.config.ts << 'EOF'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'client/dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2015',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom']
        }
      }
    }
  },
  root: 'client',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared')
    }
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: `http://localhost:${APP_PORT}`,
        changeOrigin: true
      }
    }
  }
});
EOF
    
    # tailwind.config.ts
    cat > tailwind.config.ts << 'EOF'
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './client/src/**/*.{js,ts,jsx,tsx,mdx}',
    './client/index.html'
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a'
        }
      },
      animation: {
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
      }
    },
  },
  plugins: [],
};

export default config;
EOF
    
    # postcss.config.js
    cat > postcss.config.js << 'EOF'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
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
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": false,
    "outDir": "./dist",
    "rootDir": "./",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./client/src/*"],
      "@shared/*": ["./shared/*"]
    }
  },
  "include": [
    "server/**/*",
    "shared/**/*",
    "client/src/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "client/dist"
  ]
}
EOF
    
    # .env
    cat > .env << EOF
# Configuração da Aplicação
NODE_ENV=production
PORT=${APP_PORT}
DOMAIN=${DOMAIN}

# Configuração do Banco de Dados
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}

# Configuração de Segurança
SESSION_SECRET=ligai-super-secret-key-$(date +%s)

# Configuração de SSL
SSL_ENABLED=$([ "$SETUP_SSL" = "s" ] && echo "true" || echo "false")

# Configuração de Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# URLs da Aplicação
BASE_URL=http$([ "$SETUP_SSL" = "s" ] && echo "s" || echo "")://${DOMAIN}
API_URL=http$([ "$SETUP_SSL" = "s" ] && echo "s" || echo "")://${DOMAIN}/api

# Configurações de CORS
CORS_ORIGIN=http$([ "$SETUP_SSL" = "s" ] && echo "s" || echo "")://${DOMAIN}
EOF
    
    # .gitignore
    cat > .gitignore << 'EOF'
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Production builds
dist/
client/dist/
build/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db

# Logs
logs/
*.log

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Uploads
uploads/
!uploads/.gitkeep
EOF
    
    # README.md
    cat > README.md << EOF
# LigAI Dashboard

Sistema Completo de Gestão de Leads WhatsApp

## Informações da Instalação

- **Domínio**: ${DOMAIN}
- **Porta**: ${APP_PORT}
- **Versão**: 3.0.0
- **Banco**: PostgreSQL (${DB_NAME})
- **SSL**: $([ "$SETUP_SSL" = "s" ] && echo "Habilitado" || echo "Desabilitado")

## Comandos Úteis

\`\`\`bash
# Ver status do serviço
sudo systemctl status ligai

# Ver logs em tempo real
sudo journalctl -u ligai -f

# Reiniciar aplicação
sudo systemctl restart ligai

# Verificar configuração do Nginx
sudo nginx -t

# Recarregar Nginx
sudo systemctl reload nginx
\`\`\`

## URLs de Acesso

- **Principal**: http$([ "$SETUP_SSL" = "s" ] && echo "s" || echo "")://${DOMAIN}
- **API Health**: http$([ "$SETUP_SSL" = "s" ] && echo "s" || echo "")://${DOMAIN}/api/health
- **API Info**: http$([ "$SETUP_SSL" = "s" ] && echo "s" || echo "")://${DOMAIN}/api/info

## Estrutura do Projeto

\`\`\`
${APP_DIRECTORY}/
├── client/          # Frontend React
├── server/          # Backend Express
├── shared/          # Código compartilhado
├── uploads/         # Arquivos enviados
└── migrations/      # Migrações do banco
\`\`\`

Instalado em: $(date +'%d/%m/%Y às %H:%M:%S')
EOF
}

# Instalar dependências e build
install_dependencies() {
    log "Instalando dependências da aplicação..."
    
    cd "${APP_DIRECTORY}"
    
    # Instalar dependências
    npm install
    
    # Build do frontend
    log "Fazendo build do frontend..."
    npm run build
    
    success "Dependências instaladas e build concluído!"
}

# Configurar serviço systemd
setup_systemd() {
    log "Configurando serviço systemd..."
    
    # Criar arquivo de serviço
    cat > /etc/systemd/system/${APP_NAME}.service << EOF
[Unit]
Description=${APP_DISPLAY_NAME}
Documentation=https://github.com/seu-usuario/ligai-dashboard
After=network.target postgresql.service nginx.service
Wants=postgresql.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIRECTORY}
Environment=NODE_ENV=production
EnvironmentFile=${APP_DIRECTORY}/.env
ExecStart=/usr/bin/npm start
ExecReload=/bin/kill -HUP \$MAINPID
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${APP_NAME}

# Configurações de segurança
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=${APP_DIRECTORY}
ReadWritePaths=/tmp

[Install]
WantedBy=multi-user.target
EOF
    
    # Configurar permissões
    chown -R "${APP_USER}:${APP_USER}" "${APP_DIRECTORY}"
    chmod -R 755 "${APP_DIRECTORY}"
    chmod 644 "${APP_DIRECTORY}/.env"
    
    # Recarregar systemd
    systemctl daemon-reload
    systemctl enable "${APP_NAME}"
    
    success "Serviço systemd configurado!"
}

# Iniciar todos os serviços
start_services() {
    log "Iniciando todos os serviços..."
    
    # Verificar e iniciar PostgreSQL
    if ! systemctl is-active --quiet postgresql; then
        systemctl start postgresql
        sleep 3
    fi
    
    # Verificar e iniciar Nginx
    if ! systemctl is-active --quiet nginx; then
        systemctl start nginx
        sleep 2
    fi
    
    # Configurar SSL se solicitado
    setup_ssl
    
    # Iniciar aplicação
    systemctl start "${APP_NAME}"
    
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
        systemctl status "${APP_NAME}" --no-pager || true
        return 1
    fi
    
    # Testar conectividade
    echo ""
    echo -e "${YELLOW}=== TESTE DE CONECTIVIDADE ===${NC}"
    
    if curl -s "http://localhost:${APP_PORT}/api/health" > /dev/null; then
        echo "✅ API: Respondendo"
    else
        echo "❌ API: Não responde"
        return 1
    fi
    
    if curl -s "http://localhost:80" > /dev/null; then
        echo "✅ Nginx Proxy: Funcionando"
    else
        echo "❌ Nginx Proxy: Falha"
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
    echo "🌐 URL Principal: http$([ "$SETUP_SSL" = "s" ] && echo "s" || echo "")://${DOMAIN}"
    echo "🔗 API Health: http$([ "$SETUP_SSL" = "s" ] && echo "s" || echo "")://${DOMAIN}/api/health"
    echo "🔗 API Info: http$([ "$SETUP_SSL" = "s" ] && echo "s" || echo "")://${DOMAIN}/api/info"
    if [[ "$SETUP_SSL" != "s" ]]; then
        echo "🌐 URL Local: http://localhost:${APP_PORT}"
    fi
    echo ""
    
    echo -e "${BLUE}=== INFORMAÇÕES DO SISTEMA ===${NC}"
    echo ""
    echo "📁 Diretório: ${APP_DIRECTORY}"
    echo "👤 Usuário: ${APP_USER}"
    echo "🐘 Banco: ${DB_NAME} (usuário: ${DB_USER})"
    echo "🔧 Serviço: ${APP_NAME}.service"
    echo "🚪 Porta: ${APP_PORT}"
    echo "🔒 SSL: $([ "$SETUP_SSL" = "s" ] && echo "Habilitado" || echo "Desabilitado")"
    echo ""
    
    echo -e "${YELLOW}=== COMANDOS ÚTEIS ===${NC}"
    echo ""
    echo "# Ver status dos serviços:"
    echo "sudo systemctl status ${APP_NAME}"
    echo "sudo systemctl status nginx"
    echo "sudo systemctl status postgresql"
    echo ""
    echo "# Ver logs da aplicação:"
    echo "sudo journalctl -u ${APP_NAME} -f"
    echo ""
    echo "# Reiniciar aplicação:"
    echo "sudo systemctl restart ${APP_NAME}"
    echo ""
    echo "# Verificar configuração do Nginx:"
    echo "sudo nginx -t"
    echo ""
    
    echo -e "${GREEN}=== PRÓXIMOS PASSOS ===${NC}"
    echo ""
    echo "1. ✅ Acesse http$([ "$SETUP_SSL" = "s" ] && echo "s" || echo "")://${DOMAIN} para verificar o funcionamento"
    echo "2. 📝 Configure seu DNS para apontar ${DOMAIN} para este servidor"
    if [[ "$SETUP_SSL" != "s" ]]; then
        echo "3. 🔒 Configure SSL/HTTPS executando: sudo certbot --nginx -d ${DOMAIN}"
    fi
    echo "4. ⚙️  Personalize as configurações no arquivo ${APP_DIRECTORY}/.env"
    echo "5. 📖 Consulte a documentação em ${APP_DIRECTORY}/README.md"
    echo ""
    
    success "LigAI Dashboard v3.0 instalado e funcionando perfeitamente!"
    echo ""
    echo -e "${CYAN}Obrigado por usar o LigAI Dashboard! 🚀${NC}"
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
        log "Verificando logs para diagnóstico..."
        systemctl status "${APP_NAME}" --no-pager || true
        echo ""
        log "Para ver logs detalhados execute:"
        echo "sudo journalctl -u ${APP_NAME} -n 50"
        exit 1
    fi
}

# Executar instalação
main "$@"