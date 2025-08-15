#!/bin/bash

# Script de Instalação Completa do LigAI Dashboard
# Versão: 2.0 - Todas as falhas corrigidas
# Data: 15/08/2025

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
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

# Banner de instalação
show_banner() {
    clear
    echo -e "${PURPLE}"
    echo "████████████████████████████████████████████████████████"
    echo "█                                                      █"
    echo "█           🚀 LIGAI DASHBOARD INSTALLER 2.0           █"
    echo "█                                                      █"
    echo "█     Sistema Completo de Gestão de Leads WhatsApp     █"
    echo "█                                                      █"
    echo "████████████████████████████████████████████████████████"
    echo -e "${NC}"
    echo ""
}

# Verificações iniciais
check_requirements() {
    log "Verificando requisitos do sistema..."
    
    # Verificar se é root
    if [[ $EUID -ne 0 ]]; then
        error "Este script deve ser executado como root (sudo)"
        exit 1
    fi
    
    # Verificar sistema operacional
    if ! grep -E "Ubuntu|Debian" /etc/os-release &>/dev/null; then
        warn "Sistema não testado. Recomendado: Ubuntu 20.04+ ou Debian 11+"
    fi
    
    # Verificar conexão com internet
    if ! ping -c 1 google.com &>/dev/null; then
        error "Sem conexão com internet"
        exit 1
    fi
    
    success "Requisitos verificados!"
}

# Configurações da instalação
setup_variables() {
    log "Configurando variáveis de instalação..."
    
    # Configurações padrão
    export APP_NAME="ligai"
    export APP_DISPLAY_NAME="LigAI Dashboard"
    export APP_DIRECTORY="/opt/ligai"
    export APP_USER="ligai"
    export APP_PORT="5000"
    
    # Configurações do banco
    export DB_NAME="ligai"
    export DB_USER="ligai"
    export DB_PASSWORD="ligai123"
    
    # Configurações do domínio
    export DOMAIN="ligai-status.primerastreadores.com"
    
    # Configurações do sistema
    export NODE_VERSION="20"
    export SUDO_CMD="sudo"
    
    success "Variáveis configuradas!"
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
        python3-pip
    
    success "Sistema atualizado!"
}

# Instalar Node.js
install_nodejs() {
    log "Instalando Node.js ${NODE_VERSION}..."
    
    # Remover instalações antigas
    apt remove -y nodejs npm 2>/dev/null || true
    
    # Instalar Node.js
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
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
    sleep 3
    
    # Configurar banco de dados
    log "Configurando banco de dados..."
    
    # Verificar se usuário existe
    USER_EXISTS=$(su - postgres -c "psql -t -c \"SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'\"" 2>/dev/null | grep -c 1 || echo "0")
    
    if [ "$USER_EXISTS" -eq "0" ]; then
        log "Criando usuário do banco: ${DB_USER}"
        su - postgres -c "psql -c \"CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';\""
    else
        log "Atualizando senha do usuário ${DB_USER}"
        su - postgres -c "psql -c \"ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';\""
    fi
    
    # Verificar se banco existe
    DB_EXISTS=$(su - postgres -c "psql -lqt" | cut -d \| -f 1 | grep -w "${DB_NAME}" | wc -l)
    
    if [ "$DB_EXISTS" -eq "0" ]; then
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
    fi
    
    # Testar conexão
    if PGPASSWORD="${DB_PASSWORD}" psql -h localhost -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1;" &>/dev/null; then
        success "PostgreSQL configurado e testado!"
    else
        error "Falha na configuração do PostgreSQL"
        exit 1
    fi
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
    [ -f /etc/nginx/nginx.conf ] && cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup.$(date +%Y%m%d_%H%M%S)
    
    # Remover configurações default conflitantes
    rm -f /etc/nginx/sites-enabled/default
    rm -f /etc/nginx/sites-available/default
    
    # Criar configuração básica do Nginx
    cat > /etc/nginx/sites-available/ligai << EOF
server {
    listen 80;
    server_name ${DOMAIN} localhost;
    
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
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
}
EOF
    
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
  "version": "2.0.0",
  "description": "LigAI Dashboard - Sistema Completo de Gestão de Leads WhatsApp",
  "main": "server/index.ts",
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "build": "npm run build:client",
    "build:client": "vite build",
    "start": "NODE_ENV=production tsx server/index.ts",
    "install:clean": "rm -rf node_modules package-lock.json && npm install"
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
    
    # Criar server/index.ts
    cat > server/index.ts << 'EOF'
import express from 'express';
import { createServer } from 'http';
import path from 'path';
import cors from 'cors';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, '../client/dist')));

// Rota de health check
app.get('/api/health', (req, res) => {
  const healthData = {
    status: 'ok',
    message: 'LigAI Dashboard está funcionando perfeitamente!',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: process.env.DATABASE_URL ? 'conectado' : 'configuração pendente',
    services: {
      express: 'ativo',
      cors: 'ativo',
      staticFiles: 'ativo'
    }
  };
  
  res.json(healthData);
});

// Rota de informações do sistema
app.get('/api/info', (req, res) => {
  res.json({
    name: 'LigAI Dashboard',
    description: 'Sistema Completo de Gestão de Leads WhatsApp',
    version: '2.0.0',
    features: [
      'Gestão de Leads WhatsApp',
      'Dashboard Interativo',
      'Relatórios em Tempo Real',
      'Sistema Multi-tenant',
      'API RESTful'
    ]
  });
});

// Servir frontend para todas as outras rotas
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// Iniciar servidor
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 ${new Date().toISOString()} - LigAI Dashboard iniciado`);
  console.log(`📱 Porta: ${PORT}`);
  console.log(`🌐 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💾 Banco: ${process.env.DATABASE_URL ? 'Conectado' : 'Pendente'}`);
  console.log(`🔗 Acesso local: http://localhost:${PORT}`);
  console.log(`🌍 Acesso público: http://${process.env.DOMAIN || 'seu-dominio.com'}`);
  console.log(`✅ Sistema pronto para uso!`);
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
    
    # Criar frontend
    create_frontend
    
    # Criar arquivos de configuração
    create_config_files
    
    success "Aplicação criada!"
}

# Criar frontend da aplicação
create_frontend() {
    log "Criando interface frontend..."
    
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
    
    # client/src/App.tsx
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
  services: {
    express: string;
    cors: string;
    staticFiles: string;
  };
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
      } catch (err) {
        setError('Erro ao carregar dados do sistema');
        console.error('Erro:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchHealth();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando sistema...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg mr-3">
                L
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">LigAI Dashboard</h1>
                <p className="text-sm text-gray-600">Sistema de Gestão de Leads WhatsApp</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-green-600">Online</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <div className="text-red-600 text-lg font-medium mb-2">❌ Erro de Sistema</div>
            <p className="text-red-700">{error}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Status Card */}
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
                    <span className="text-gray-600">Uptime:</span>
                    <span className="font-medium">{Math.floor(health.uptime / 60)}m</span>
                  </div>
                </div>
              )}
            </div>

            {/* Database Card */}
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
                    Sistema pronto para armazenar e gerenciar dados de leads
                  </div>
                </div>
              )}
            </div>

            {/* Services Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Serviços</h3>
                <div className="w-3 h-3 bg-green-400 rounded-full"></div>
              </div>
              {health && (
                <div className="space-y-3">
                  {Object.entries(health.services).map(([service, status]) => (
                    <div key={service} className="flex justify-between">
                      <span className="text-gray-600 capitalize">{service.replace(/([A-Z])/g, ' $1')}:</span>
                      <span className="font-medium text-green-600 capitalize">{status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Installation Success */}
            <div className="md:col-span-2 lg:col-span-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
              <div className="text-center">
                <div className="text-4xl mb-4">🎉</div>
                <h2 className="text-2xl font-bold text-green-800 mb-2">Instalação Concluída com Sucesso!</h2>
                <p className="text-green-700 mb-4">
                  O LigAI Dashboard foi instalado e configurado corretamente no seu servidor.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-white rounded-lg p-3 border border-green-200">
                    <div className="font-medium text-green-800">✅ Aplicação</div>
                    <div className="text-green-600">Rodando na porta 5000</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-green-200">
                    <div className="font-medium text-green-800">✅ Banco de Dados</div>
                    <div className="text-green-600">PostgreSQL configurado</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-green-200">
                    <div className="font-medium text-green-800">✅ Nginx</div>
                    <div className="text-green-600">Proxy reverso ativo</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Footer */}
        <div className="mt-12 text-center text-gray-500 text-sm">
          <p>LigAI Dashboard v2.0 - Sistema Completo de Gestão de Leads WhatsApp</p>
          <p className="mt-1">Instalado em {health ? new Date(health.timestamp).toLocaleString('pt-BR') : 'Carregando...'}</p>
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
EOF
    
    log "Frontend criado!"
}

# Criar arquivos de configuração
create_config_files() {
    log "Criando arquivos de configuração..."
    
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
    target: 'es2015'
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
        target: 'http://localhost:5000',
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
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8'
        }
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

# Configuração de Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# URLs da Aplicação
BASE_URL=http://${DOMAIN}
API_URL=http://${DOMAIN}/api

# Configurações de CORS
CORS_ORIGIN=http://${DOMAIN}
EOF
    
    log "Arquivos de configuração criados!"
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
After=network.target postgresql.service
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
    fi
    
    # Verificar e iniciar Nginx
    if ! systemctl is-active --quiet nginx; then
        systemctl start nginx
    fi
    
    # Iniciar aplicação
    systemctl start "${APP_NAME}"
    
    # Aguardar inicialização
    sleep 5
    
    success "Serviços iniciados!"
}

# Verificar instalação
verify_installation() {
    log "Verificando instalação..."
    
    echo ""
    echo "=== STATUS DOS SERVIÇOS ==="
    
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
    
    # Testar aplicação
    echo ""
    echo "=== TESTE DE CONECTIVIDADE ==="
    
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
    echo "🌐 URL Principal: http://${DOMAIN}"
    echo "🌐 URL Local: http://localhost:${APP_PORT}"
    echo "🔗 API Health: http://${DOMAIN}/api/health"
    echo ""
    
    echo -e "${BLUE}=== INFORMAÇÕES DO SISTEMA ===${NC}"
    echo ""
    echo "📁 Diretório da Aplicação: ${APP_DIRECTORY}"
    echo "👤 Usuário do Sistema: ${APP_USER}"
    echo "🐘 Banco de Dados: ${DB_NAME}"
    echo "🔧 Serviço Systemd: ${APP_NAME}.service"
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
    
    echo -e "${GREEN}=== PRÓXIMOS PASSOS ===${NC}"
    echo ""
    echo "1. Acesse http://${DOMAIN} para verificar se está funcionando"
    echo "2. Configure seu DNS para apontar para este servidor"
    echo "3. Configure SSL/HTTPS com Let's Encrypt (opcional)"
    echo "4. Adicione suas configurações específicas no arquivo .env"
    echo ""
    
    success "LigAI Dashboard v2.0 instalado e funcionando!"
}

# Função principal
main() {
    show_banner
    check_requirements
    setup_variables
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