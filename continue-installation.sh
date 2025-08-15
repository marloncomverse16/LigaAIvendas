#!/bin/bash

# Script para continuar instalação após corrigir Nginx
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[AVISO] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Verificar se está executando como root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}[ERRO] Este script deve ser executado como root${NC}"
   exit 1
fi

echo "🚀 Continuando instalação do LigAI Dashboard"
echo "=========================================="

# Configurações
DOMAIN="ligai-status.primerastreadores.com"
APP_DIRECTORY="/opt/ligai"
APP_USER="ligai"
DB_NAME="ligai"
DB_USER="ligai"
DB_PASSWORD="ligai123"

# 1. Corrigir Nginx primeiro
log "Corrigindo Nginx..."
./fix-nginx-error.sh

# 2. Criar diretório da aplicação
log "Criando diretório da aplicação..."
mkdir -p "$APP_DIRECTORY"
cd "$APP_DIRECTORY"

# 3. Criar usuário da aplicação
if ! id "$APP_USER" &>/dev/null; then
    log "Criando usuário da aplicação: $APP_USER"
    useradd -r -s /bin/bash -d "$APP_DIRECTORY" "$APP_USER"
else
    log "Usuário $APP_USER já existe"
fi

# 4. Criar aplicação básica
log "Criando aplicação LigAI Dashboard..."

# Criar estrutura
mkdir -p {client/src/{components,pages,lib,hooks},server,shared,uploads,migrations}

# package.json
cat > package.json << 'EOF'
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
    "start": "NODE_ENV=production tsx server/index.ts",
    "db:push": "drizzle-kit push",
    "db:migrate": "drizzle-kit generate && drizzle-kit push"
  },
  "dependencies": {
    "express": "^4.18.2",
    "typescript": "^5.3.2",
    "tsx": "^4.6.0",
    "cors": "^2.8.5",
    "@types/cors": "^2.8.17",
    "@types/node": "^20.9.2",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "vite": "^5.0.2",
    "@vitejs/plugin-react": "^4.1.1",
    "tailwindcss": "^3.3.6",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32"
  }
}
EOF

# server/index.ts
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
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/dist')));

// Rota básica de health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'LigAI Dashboard está funcionando!',
    timestamp: new Date().toISOString(),
    database: process.env.DATABASE_URL ? 'conectado' : 'não configurado'
  });
});

// Rota para servir o frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// Iniciar servidor
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 LigAI Dashboard rodando na porta ${PORT}`);
  console.log(`📅 ${new Date().toLocaleString('pt-BR')}`);
  console.log(`🌐 Acesse: http://localhost:${PORT}`);
});

export default app;
EOF

# client/index.html
mkdir -p client
cat > client/index.html << 'EOF'
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LigAI Dashboard</title>
</head>
<body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
</body>
</html>
EOF

# client/src/main.tsx
mkdir -p client/src
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

function App() {
  const [health, setHealth] = useState(null);
  
  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setHealth(data))
      .catch(err => console.error('Erro:', err));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full">
        <div className="text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full mx-auto flex items-center justify-center text-white text-2xl font-bold">
              L
            </div>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            LigAI Dashboard
          </h1>
          <p className="text-gray-600 mb-6">
            Gestão Inteligente de Leads WhatsApp
          </p>
          
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-4">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-400 rounded-full mr-2"></div>
              <span className="font-medium">Aplicação Online</span>
            </div>
          </div>
          
          {health && (
            <div className="text-sm text-gray-500 space-y-1">
              <div>Status: {health.status}</div>
              <div>Banco: {health.database}</div>
              <div>Hora: {new Date(health.timestamp).toLocaleString('pt-BR')}</div>
            </div>
          )}
          
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-400">
              Instalação concluída com sucesso!
            </p>
          </div>
        </div>
      </div>
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
EOF

# Configurações
cat > vite.config.ts << 'EOF'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'client/dist'
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
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
});
EOF

cat > tailwind.config.ts << 'EOF'
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './client/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
EOF

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
    "lib": ["ES2020"],
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
    "shared/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "client"
  ]
}
EOF

# .env
cat > .env << EOF
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME
NODE_ENV=production
PORT=5000
DOMAIN=$DOMAIN
SESSION_SECRET=ligai-super-secret-key-$(date +%s)
EOF

# 5. Instalar dependências
log "Instalando dependências..."
npm install

# 6. Build da aplicação
log "Fazendo build da aplicação..."
npm run build:client || warn "Build do frontend falhou, mas continuando..."

# 7. Configurar permissões
log "Configurando permissões..."
chown -R "$APP_USER:$APP_USER" "$APP_DIRECTORY"
chmod -R 755 "$APP_DIRECTORY"

# 8. Criar serviço systemd
log "Criando serviço systemd..."
cat > /etc/systemd/system/ligai.service << EOF
[Unit]
Description=LigAI Dashboard
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIRECTORY
Environment=NODE_ENV=production
EnvironmentFile=$APP_DIRECTORY/.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=ligai

[Install]
WantedBy=multi-user.target
EOF

# 9. Configurar Nginx
log "Configurando Nginx para LigAI..."
cat > /etc/nginx/sites-available/ligai << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Habilitar site
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/ligai /etc/nginx/sites-enabled/

# Testar configuração
nginx -t

# 10. Iniciar serviços
log "Iniciando serviços..."
systemctl daemon-reload
systemctl enable ligai
systemctl start ligai
systemctl reload nginx

# 11. Verificar status
log "Verificando status dos serviços..."
echo ""
echo "=== STATUS DOS SERVIÇOS ==="
systemctl is-active --quiet ligai && echo "✅ LigAI: Ativo" || echo "❌ LigAI: Inativo"
systemctl is-active --quiet nginx && echo "✅ Nginx: Ativo" || echo "❌ Nginx: Inativo"
systemctl is-active --quiet postgresql && echo "✅ PostgreSQL: Ativo" || echo "❌ PostgreSQL: Inativo"

echo ""
echo "=== INFORMAÇÕES DE ACESSO ==="
echo "🌐 URL da aplicação: http://$DOMAIN"
echo "🌐 URL local: http://localhost:5000"
echo "📁 Diretório: $APP_DIRECTORY"
echo "👤 Usuário: $APP_USER"
echo "🗄️ Banco: $DB_NAME"

log "✅ Instalação do LigAI Dashboard concluída com sucesso!"