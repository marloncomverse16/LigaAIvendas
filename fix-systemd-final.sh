#!/bin/bash

# Script para corrigir DEFINITIVAMENTE o problema do systemd
# Resolve status=217/USER e status=200/CHDIR

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERRO] $1${NC}"
    exit 1
}

warn() {
    echo -e "${YELLOW}[AVISO] $1${NC}"
}

echo "🔧 Correção Definitiva do SystemD LigAI"
echo "======================================"

# Verificar se é root ou sudo
if [[ $EUID -eq 0 ]]; then
    SUDO_CMD=""
    log "Executando como root"
else
    if sudo -n true 2>/dev/null; then
        SUDO_CMD="sudo"
        log "Executando com sudo"
    else
        error "Execute como root ou com sudo: sudo $0"
    fi
fi

# Parar serviço atual
log "Parando serviço atual..."
$SUDO_CMD systemctl stop ligai 2>/dev/null || true

# Detectar instalação existente
log "Detectando instalação..."

if [[ -d "/root/ligai" ]]; then
    APP_DIR="/root/ligai"
    SERVICE_USER="root"
    SERVICE_GROUP="root"
    USER_HOME="/root"
    log "✅ Encontrado em /root/ligai"
elif [[ -d "/home/ligai/ligai" ]]; then
    APP_DIR="/home/ligai/ligai"
    SERVICE_USER="ligai"
    SERVICE_GROUP="ligai"
    USER_HOME="/home/ligai"
    log "✅ Encontrado em /home/ligai/ligai"
else
    error "❌ Aplicação não encontrada em /root/ligai ou /home/ligai/ligai"
fi

log "Diretório: $APP_DIR"
log "Usuário: $SERVICE_USER"

# Verificar se usuário existe (criar se necessário)
if [[ "$SERVICE_USER" != "root" ]]; then
    if ! id "$SERVICE_USER" &>/dev/null; then
        log "Criando usuário $SERVICE_USER..."
        $SUDO_CMD useradd -m -s /bin/bash "$SERVICE_USER" || true
        $SUDO_CMD usermod -aG sudo "$SERVICE_USER" || true
    else
        log "✅ Usuário $SERVICE_USER já existe"
    fi
fi

# Corrigir permissões COMPLETAMENTE
log "Corrigindo todas as permissões..."

# Garantir que o diretório existe
if [[ ! -d "$APP_DIR" ]]; then
    error "❌ Diretório $APP_DIR não existe!"
fi

# Ajustar ownership recursivamente
$SUDO_CMD chown -R "$SERVICE_USER:$SERVICE_GROUP" "$APP_DIR"

# Ajustar permissões
$SUDO_CMD chmod -R 755 "$APP_DIR"
$SUDO_CMD chmod 644 "$APP_DIR"/.env 2>/dev/null || true

# Verificar se npm existe e funciona
log "Verificando Node.js e npm..."
cd "$APP_DIR"

if ! command -v node &> /dev/null; then
    error "❌ Node.js não está instalado!"
fi

if ! command -v npm &> /dev/null; then
    error "❌ npm não está instalado!"
fi

NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
log "✅ Node.js: $NODE_VERSION"
log "✅ npm: $NPM_VERSION"

# Verificar dependências
if [[ ! -d "node_modules" ]]; then
    log "Instalando dependências npm..."
    if [[ "$SERVICE_USER" == "root" ]]; then
        npm install --production
    else
        $SUDO_CMD -u "$SERVICE_USER" npm install --production
    fi
fi

# Testar execução do comando
log "Testando comando npm..."
if [[ "$SERVICE_USER" == "root" ]]; then
    timeout 5 npm start --dry-run || warn "Teste do npm falhou (pode ser normal)"
else
    timeout 5 $SUDO_CMD -u "$SERVICE_USER" npm start --dry-run || warn "Teste do npm falhou (pode ser normal)"
fi

# Criar serviço systemd SUPER SIMPLIFICADO
log "Criando serviço systemd corrigido..."

$SUDO_CMD tee /etc/systemd/system/ligai.service > /dev/null << EOF
[Unit]
Description=LigAI Dashboard
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Recarregar systemd
log "Recarregando systemd..."
$SUDO_CMD systemctl daemon-reload
$SUDO_CMD systemctl enable ligai

# Verificar configuração
log "Verificando configuração..."
if $SUDO_CMD systemctl cat ligai | grep -q "User=$SERVICE_USER"; then
    log "✅ Configuração do usuário correta"
else
    error "❌ Problema na configuração do usuário"
fi

if $SUDO_CMD systemctl cat ligai | grep -q "WorkingDirectory=$APP_DIR"; then
    log "✅ Configuração do diretório correta"
else
    error "❌ Problema na configuração do diretório"
fi

# Testar acesso ao diretório como usuário do serviço
log "Testando acesso ao diretório..."
if [[ "$SERVICE_USER" == "root" ]]; then
    if cd "$APP_DIR" && ls -la > /dev/null; then
        log "✅ Acesso ao diretório funciona"
    else
        error "❌ Problema de acesso ao diretório"
    fi
else
    if $SUDO_CMD -u "$SERVICE_USER" test -r "$APP_DIR" && $SUDO_CMD -u "$SERVICE_USER" test -x "$APP_DIR"; then
        log "✅ Acesso ao diretório funciona"
    else
        error "❌ Problema de acesso ao diretório para usuário $SERVICE_USER"
    fi
fi

# Iniciar serviço
log "Iniciando serviço..."
if $SUDO_CMD systemctl start ligai; then
    log "✅ Serviço iniciado"
else
    warn "❌ Falha ao iniciar - verificando logs..."
    $SUDO_CMD journalctl -u ligai --no-pager -n 10
    exit 1
fi

# Aguardar e verificar
sleep 3

if $SUDO_CMD systemctl is-active --quiet ligai; then
    echo ""
    echo "🎉 SUCESSO! LigAI está funcionando!"
    echo "====================================="
    $SUDO_CMD systemctl status ligai --no-pager -l
else
    echo ""
    echo "❌ PROBLEMA - Verificando logs:"
    echo "==============================="
    $SUDO_CMD journalctl -u ligai --no-pager -n 15
    exit 1
fi

echo ""
echo "✅ Correção concluída com sucesso!"
echo "Comando para verificar: sudo systemctl status ligai"