#!/bin/bash

# Script para corrigir erro do Nginx durante instalação
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERRO] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

echo "🔧 Corrigindo erro do Nginx"
echo "=========================="

# Verificar se está executando como root
if [[ $EUID -ne 0 ]]; then
   error "Este script deve ser executado como root"
   exit 1
fi

log "Verificando status do Nginx..."
systemctl status nginx.service --no-pager || true

log "Verificando logs do Nginx..."
journalctl -xeu nginx.service --no-pager -n 10 || true

log "Testando configuração do Nginx..."
nginx -t || {
    error "Configuração do Nginx inválida"
    
    # Backup da configuração atual
    cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
    
    # Verificar se há configurações conflitantes
    log "Verificando configurações..."
    find /etc/nginx/ -name "*.conf" -exec grep -l "listen.*80" {} \; 2>/dev/null || true
    
    # Remover configurações default conflitantes
    if [ -f "/etc/nginx/sites-enabled/default" ]; then
        log "Removendo configuração default..."
        rm -f /etc/nginx/sites-enabled/default
    fi
    
    # Criar configuração básica
    cat > /etc/nginx/sites-available/default << 'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    root /var/www/html;
    index index.html index.htm index.nginx-debian.html;
    
    server_name _;
    
    location / {
        try_files $uri $uri/ =404;
    }
}
EOF
    
    # Habilitar configuração
    ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
    
    log "Testando nova configuração..."
    nginx -t
}

# Parar Nginx se estiver rodando
log "Parando Nginx..."
systemctl stop nginx 2>/dev/null || true

# Verificar se algum processo está usando a porta 80
log "Verificando porta 80..."
if lsof -i :80 2>/dev/null; then
    log "Processos usando porta 80 encontrados, tentando finalizar..."
    fuser -k 80/tcp 2>/dev/null || true
    sleep 2
fi

# Iniciar Nginx
log "Iniciando Nginx..."
systemctl start nginx

# Verificar status
if systemctl is-active --quiet nginx; then
    log "✅ Nginx iniciado com sucesso!"
    systemctl enable nginx
else
    error "❌ Falha ao iniciar Nginx"
    systemctl status nginx.service --no-pager
    exit 1
fi

log "✅ Nginx configurado com sucesso!"