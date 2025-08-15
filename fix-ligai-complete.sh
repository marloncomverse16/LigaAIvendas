#!/bin/bash

# Script para corrigir completamente o LigAI Dashboard
# Corrige tanto systemd quanto nginx

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

error() {
    echo -e "${RED}[ERRO] $1${NC}"
    exit 1
}

warn() {
    echo -e "${YELLOW}[AVISO] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Verificar se tem privilégios sudo
check_privileges() {
    if [[ $EUID -eq 0 ]]; then
        SUDO_CMD=""
        log "Executando como root"
    elif sudo -n true 2>/dev/null; then
        SUDO_CMD="sudo"
        log "Executando com sudo"
    else
        error "Este script precisa de privilégios sudo. Execute: sudo $0"
    fi
}

# Parar serviços
stop_services() {
    log "Parando serviços..."
    
    $SUDO_CMD systemctl stop ligai 2>/dev/null || true
    $SUDO_CMD systemctl stop nginx 2>/dev/null || true
    
    log "Serviços parados"
}

# Corrigir problema do systemd
fix_systemd() {
    log "Corrigindo serviço systemd do LigAI..."
    
    # Detectar usuário e diretório corretos
    if [[ -d "/root/ligai" ]]; then
        APP_DIR="/root/ligai"
        SERVICE_USER="root"
        SERVICE_GROUP="root"
    elif [[ -d "/home/ligai/ligai" ]]; then
        APP_DIR="/home/ligai/ligai"
        SERVICE_USER="ligai"
        SERVICE_GROUP="ligai"
    else
        error "Diretório da aplicação não encontrado. Verifique /root/ligai ou /home/ligai/ligai"
    fi
    
    log "Usando diretório: $APP_DIR"
    log "Usuário do serviço: $SERVICE_USER"
    
    # Verificar se usuário existe (criar se necessário quando é ligai)
    if [[ "$SERVICE_USER" == "ligai" ]] && ! id ligai &>/dev/null; then
        log "Criando usuário ligai..."
        $SUDO_CMD useradd -m -s /bin/bash ligai || true
        $SUDO_CMD usermod -aG sudo ligai || true
    fi
    
    # Ajustar permissões
    $SUDO_CMD chown -R $SERVICE_USER:$SERVICE_GROUP "$APP_DIR"
    
    # Criar serviço corrigido
    log "Criando arquivo de serviço corrigido..."
    $SUDO_CMD tee /etc/systemd/system/ligai.service > /dev/null << EOF
[Unit]
Description=LigAI Dashboard - Gestão de Leads WhatsApp
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_GROUP
WorkingDirectory=$APP_DIR
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

# Configurações de segurança
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=false
ReadWritePaths=$APP_DIR
ReadWritePaths=/tmp

[Install]
WantedBy=multi-user.target
EOF
    
    # Verificar dependências npm
    log "Verificando dependências npm..."
    cd "$APP_DIR"
    
    if [[ ! -d "node_modules" ]] || [[ ! -f "package-lock.json" ]]; then
        log "Instalando dependências npm..."
        if [[ "$SERVICE_USER" == "root" ]]; then
            npm install --production
        else
            $SUDO_CMD -u $SERVICE_USER npm install --production
        fi
    fi
    
    # Recarregar systemd
    $SUDO_CMD systemctl daemon-reload
    $SUDO_CMD systemctl enable ligai
    
    log "Serviço systemd corrigido!"
}

# Corrigir problema do nginx
fix_nginx() {
    log "Corrigindo configuração do Nginx..."
    
    # Backup da configuração
    $SUDO_CMD cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
    
    # Verificar e remover diretivas duplicadas
    if grep -q "gzip.*on" /etc/nginx/nginx.conf; then
        log "Encontrada configuração gzip duplicada. Corrigindo..."
        
        # Criar nova configuração nginx limpa
        $SUDO_CMD tee /etc/nginx/nginx.conf > /dev/null << 'EOF'
user www-data;
worker_processes auto;
pid /run/nginx.pid;
include /etc/nginx/modules-enabled/*.conf;

events {
    worker_connections 768;
    # multi_accept on;
}

http {
    ##
    # Basic Settings
    ##

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    ##
    # SSL Settings
    ##

    ssl_protocols TLSv1 TLSv1.1 TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    ##
    # Logging Settings
    ##

    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    ##
    # Gzip Settings
    ##

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    ##
    # Virtual Host Configs
    ##

    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
EOF
        
        log "Configuração nginx corrigida"
    fi
    
    # Testar configuração
    if $SUDO_CMD nginx -t; then
        log "Configuração nginx válida"
    else
        error "Configuração nginx inválida. Verifique o erro acima"
    fi
}

# Iniciar serviços
start_services() {
    log "Iniciando serviços..."
    
    # Iniciar nginx
    if $SUDO_CMD systemctl start nginx; then
        log "✅ Nginx iniciado com sucesso"
    else
        warn "❌ Falha ao iniciar nginx - verifique configuração"
    fi
    
    # Aguardar um pouco
    sleep 3
    
    # Iniciar ligai
    if $SUDO_CMD systemctl start ligai; then
        log "✅ LigAI iniciado com sucesso"
    else
        warn "❌ Falha ao iniciar LigAI - verificando logs..."
        $SUDO_CMD journalctl -u ligai --no-pager -l -n 10
        return 1
    fi
    
    # Aguardar inicialização
    sleep 5
    
    # Verificar status final
    if $SUDO_CMD systemctl is-active --quiet ligai && $SUDO_CMD systemctl is-active --quiet nginx; then
        log "🎉 Todos os serviços estão funcionando!"
        return 0
    else
        warn "Alguns serviços podem não estar funcionando corretamente"
        return 1
    fi
}

# Verificar status final
check_final_status() {
    log "Verificando status final..."
    echo ""
    echo "=== STATUS DOS SERVIÇOS ==="
    
    # LigAI
    if $SUDO_CMD systemctl is-active --quiet ligai; then
        echo "✅ LigAI: Funcionando"
    else
        echo "❌ LigAI: Parado"
    fi
    
    # Nginx
    if $SUDO_CMD systemctl is-active --quiet nginx; then
        echo "✅ Nginx: Funcionando"
    else
        echo "❌ Nginx: Parado"
    fi
    
    # PostgreSQL
    if $SUDO_CMD systemctl is-active --quiet postgresql; then
        echo "✅ PostgreSQL: Funcionando"
    else
        echo "❌ PostgreSQL: Parado"
    fi
    
    echo ""
    
    # Verificar se ligai-status existe
    if command -v ligai-status &> /dev/null; then
        log "Executando ligai-status..."
        ligai-status || true
    fi
}

# Função principal
main() {
    echo ""
    echo "🔧 LigAI Dashboard - Correção Completa"
    echo "======================================"
    echo ""
    
    check_privileges
    stop_services
    fix_systemd
    fix_nginx
    
    if start_services; then
        log "✅ Correção concluída com sucesso!"
        check_final_status
    else
        error "❌ Alguns problemas ainda persistem. Verifique os logs acima."
    fi
}

# Executar
main "$@"