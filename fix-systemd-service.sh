#!/bin/bash

# Script para corrigir o serviço systemd do LigAI
# Corrige o erro status=217/USER

set -e

log() {
    echo -e "\033[0;32m[$(date +'%Y-%m-%d %H:%M:%S')] $1\033[0m"
}

error() {
    echo -e "\033[0;31m[ERRO] $1\033[0m"
    exit 1
}

warn() {
    echo -e "\033[1;33m[AVISO] $1\033[0m"
}

# Verificar se é root
if [[ $EUID -ne 0 ]]; then
    error "Este script deve ser executado como root"
fi

log "Corrigindo serviço systemd do LigAI..."

# Parar serviço se estiver rodando
if systemctl is-active --quiet ligai 2>/dev/null; then
    log "Parando serviço ligai..."
    systemctl stop ligai
fi

# Verificar se usuário ligai existe, se não, usar root
if id ligai &>/dev/null; then
    SERVICE_USER="ligai"
    SERVICE_HOME="/home/ligai"
    log "Usando usuário existente: ligai"
else
    SERVICE_USER="root"
    SERVICE_HOME="/root"
    warn "Usuário ligai não existe. Usando root para o serviço."
fi

# Verificar diretório da aplicação
if [[ -d "/root/ligai" ]]; then
    APP_DIR="/root/ligai"
elif [[ -d "/home/ligai/ligai" ]]; then
    APP_DIR="/home/ligai/ligai"
elif [[ -d "$SERVICE_HOME/ligai" ]]; then
    APP_DIR="$SERVICE_HOME/ligai"
else
    error "Diretório da aplicação não encontrado. Procure por: /root/ligai ou /home/ligai/ligai"
fi

log "Diretório da aplicação: $APP_DIR"

# Verificar se package.json existe
if [[ ! -f "$APP_DIR/package.json" ]]; then
    error "package.json não encontrado em $APP_DIR"
fi

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    error "Node.js não está instalado"
fi

# Verificar se npm está instalado
if ! command -v npm &> /dev/null; then
    error "npm não está instalado"
fi

log "Criando serviço systemd corrigido..."

# Criar arquivo de serviço corrigido
cat > /etc/systemd/system/ligai.service << EOF
[Unit]
Description=LigAI Dashboard - Gestão de Leads WhatsApp
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
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

# Configurações de segurança (ajustadas para funcionar)
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=false
ReadWritePaths=$APP_DIR
ReadWritePaths=/tmp

[Install]
WantedBy=multi-user.target
EOF

# Ajustar permissões do diretório da aplicação
log "Ajustando permissões..."
chown -R $SERVICE_USER:$SERVICE_USER "$APP_DIR"

# Se .env existe, ajustar permissões
if [[ -f "$APP_DIR/.env" ]]; then
    chmod 600 "$APP_DIR/.env"
    chown $SERVICE_USER:$SERVICE_USER "$APP_DIR/.env"
fi

# Verificar se dependências estão instaladas
log "Verificando dependências..."
cd "$APP_DIR"

if [[ ! -d "node_modules" ]]; then
    log "Instalando dependências npm..."
    if [[ "$SERVICE_USER" == "root" ]]; then
        npm install --production
    else
        sudo -u $SERVICE_USER npm install --production
    fi
fi

# Recarregar systemd
log "Recarregando systemd..."
systemctl daemon-reload

# Habilitar serviço
log "Habilitando serviço..."
systemctl enable ligai

# Testar configuração
log "Testando configuração do serviço..."
if systemctl is-enabled --quiet ligai; then
    log "Serviço habilitado com sucesso"
else
    error "Falha ao habilitar serviço"
fi

# Iniciar serviço
log "Iniciando serviço..."
systemctl start ligai

# Aguardar alguns segundos
sleep 5

# Verificar status
if systemctl is-active --quiet ligai; then
    log "✅ Serviço iniciado com sucesso!"
    systemctl status ligai --no-pager -l
else
    error "❌ Falha ao iniciar serviço. Verificando logs..."
    echo "--- Logs do serviço ---"
    journalctl -u ligai --no-pager -l -n 20
fi

log "Correção concluída!"
EOF