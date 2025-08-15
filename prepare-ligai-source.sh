#!/bin/bash

# Script para preparar arquivo compactado com todo o código fonte do LigAI Dashboard
# Este arquivo pode ser usado durante a instalação no VPS

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

echo "📦 Preparando código fonte do LigAI Dashboard"
echo "=============================================="

# Criar diretório temporário
TEMP_DIR="ligai-source-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

log "Copiando arquivos do projeto..."

# Copiar estrutura principal
mkdir -p {client/src/{components,pages,lib,hooks},server,shared,uploads,migrations}

# Copiar arquivos de configuração
cp ../package.json . 2>/dev/null || log "package.json não encontrado"
cp ../tsconfig.json . 2>/dev/null || log "tsconfig.json não encontrado"
cp ../vite.config.ts . 2>/dev/null || log "vite.config.ts não encontrado"
cp ../tailwind.config.ts . 2>/dev/null || log "tailwind.config.ts não encontrado"
cp ../postcss.config.js . 2>/dev/null || log "postcss.config.js não encontrado"
cp ../drizzle.config.ts . 2>/dev/null || log "drizzle.config.ts não encontrado"
cp ../components.json . 2>/dev/null || log "components.json não encontrado"

# Copiar pastas principais
cp -r ../client . 2>/dev/null || log "Pasta client não encontrada"
cp -r ../server . 2>/dev/null || log "Pasta server não encontrada" 
cp -r ../shared . 2>/dev/null || log "Pasta shared não encontrada"

# Criar arquivo .env de exemplo
cat > .env.example << 'EOF'
# Configuração do Banco de Dados
DATABASE_URL=postgresql://username:password@localhost:5432/ligai

# Configuração da Aplicação
NODE_ENV=production
PORT=5000
DOMAIN=seu-dominio.com

# Configuração de Sessão
SESSION_SECRET=sua-chave-secreta-super-forte

# Configuração de Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# URLs da aplicação
BASE_URL=https://seu-dominio.com
API_URL=https://seu-dominio.com/api

# Configurações de CORS
CORS_ORIGIN=https://seu-dominio.com
EOF

# Criar arquivo README
cat > README.md << 'EOF'
# LigAI Dashboard - Código Fonte

Este é o código fonte completo do LigAI Dashboard.

## Instalação

1. Extraia este arquivo no servidor
2. Configure o arquivo .env baseado no .env.example
3. Execute: npm install
4. Execute: npm run build
5. Execute: npm start

## Estrutura

- `/client` - Frontend React
- `/server` - Backend Express
- `/shared` - Tipos e schemas compartilhados
- `/uploads` - Arquivos enviados pelos usuários

## Comandos

- `npm run dev` - Desenvolvimento
- `npm run build` - Build para produção
- `npm start` - Iniciar em produção
EOF

# Compactar
cd ..
tar -czf "ligai-dashboard-source.tar.gz" "$TEMP_DIR"

# Limpar
rm -rf "$TEMP_DIR"

log "✅ Arquivo criado: ligai-dashboard-source.tar.gz"
info "Este arquivo contém todo o código fonte da aplicação"
info "Use este arquivo durante a instalação no VPS"

echo ""
echo "Para usar no VPS:"
echo "1. Copie ligai-dashboard-source.tar.gz para o servidor"
echo "2. Execute: tar -xzf ligai-dashboard-source.tar.gz"
echo "3. Entre na pasta extraída e continue a instalação"