#!/bin/bash

#################################################
# LigAI Dashboard - Atualizar Configuração VPS
# Configura aplicação para usar banco correto
#################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Atualizando Configuração VPS - LigAI Dashboard${NC}"
echo "=================================================="

# Verificar se é root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}Execute como root: sudo bash update-vps-config.sh${NC}"
    exit 1
fi

log() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

APP_DIR="/root/ligai-dashboard"
ENV_FILE="$APP_DIR/.env"

log "Verificando diretório da aplicação..."
if [[ ! -d "$APP_DIR" ]]; then
    echo -e "${RED}❌ Diretório $APP_DIR não encontrado${NC}"
    exit 1
fi

cd "$APP_DIR" || exit 1

# Parar serviço atual
log "Parando serviço ligai-dashboard..."
systemctl stop ligai-dashboard 2>/dev/null || true

# Backup do .env atual se existir
if [[ -f "$ENV_FILE" ]]; then
    log "Fazendo backup do .env atual..."
    cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"
fi

# Criar/atualizar arquivo .env
log "Configurando variáveis de ambiente..."
cat > "$ENV_FILE" << 'EOF'
# Configuração do Banco de Dados
DATABASE_URL=postgresql://neondb_owner:npg_GyvJKF59aLAq@ep-summer-poetry-a4l3vtny.us-east-1.aws.neon.tech/neondb?sslmode=require

# Configuração da Aplicação
NODE_ENV=production
PORT=5000

# Configuração de Sessão
SESSION_SECRET=ligai-dashboard-secret-key-2024

# Configuração de Upload
UPLOAD_DIR=/var/lib/ligai-dashboard/uploads

# URLs da aplicação
DOMAIN=ligai.primerastreadores.com
BASE_URL=https://ligai.primerastreadores.com
EOF

log "✅ Arquivo .env configurado"

# Verificar se package.json existe
if [[ ! -f "package.json" ]]; then
    log "package.json não encontrado - fazendo download da versão mais recente..."
    # Aqui você poderia fazer download ou clonar do repositório
    warn "Certifique-se de ter os arquivos da aplicação no diretório correto"
fi

# Instalar dependências se necessário
if [[ -f "package.json" ]]; then
    log "Instalando/atualizando dependências..."
    npm install --production 2>/dev/null || warn "Falha na instalação de dependências"
fi

# Verificar conectividade com banco Neon
log "Testando conectividade com banco Neon..."
export DATABASE_URL="postgresql://neondb_owner:npg_GyvJKF59aLAq@ep-summer-poetry-a4l3vtny.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Teste básico de conectividade
if command -v psql >/dev/null 2>&1; then
    if psql "$DATABASE_URL" -c "SELECT 1;" >/dev/null 2>&1; then
        log "✅ Conectividade com banco Neon funcionando"
    else
        warn "Problemas de conectividade com banco Neon"
    fi
else
    warn "psql não disponível para teste de conectividade"
fi

# Atualizar configuração do systemd
log "Atualizando serviço systemd..."
SERVICE_FILE="/etc/systemd/system/ligai-dashboard.service"

cat > "$SERVICE_FILE" << 'EOF'
[Unit]
Description=LigAI Dashboard
After=network.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=/root/ligai-dashboard
Environment=NODE_ENV=production
EnvironmentFile=/root/ligai-dashboard/.env
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ligai-dashboard

[Install]
WantedBy=multi-user.target
EOF

log "✅ Serviço systemd atualizado"

# Recarregar systemd
systemctl daemon-reload

# Criar diretório de uploads se não existir
mkdir -p /var/lib/ligai-dashboard/uploads
chown -R root:root /var/lib/ligai-dashboard

# Verificar se arquivo principal existe
if [[ -f "server/index.js" ]]; then
    log "✅ Arquivo principal encontrado: server/index.js"
elif [[ -f "server/index.ts" ]]; then
    log "⚠️ Encontrado server/index.ts - você precisa compilar TypeScript"
    warn "Execute: npm run build ou tsx server/index.ts"
else
    echo -e "${RED}❌ Arquivo principal da aplicação não encontrado${NC}"
    exit 1
fi

# Iniciar serviço
log "Iniciando serviço ligai-dashboard..."
systemctl enable ligai-dashboard
systemctl start ligai-dashboard

# Aguardar inicialização
sleep 5

# Verificar status
STATUS=$(systemctl is-active ligai-dashboard)
if [[ "$STATUS" == "active" ]]; then
    log "✅ Serviço iniciado com sucesso!"
    
    # Verificar se está respondendo
    sleep 3
    if curl -s http://localhost:5000 >/dev/null 2>&1; then
        log "✅ Aplicação respondendo na porta 5000"
    else
        warn "Aplicação pode não estar respondendo corretamente"
    fi
    
    echo
    echo -e "${GREEN}🎉 CONFIGURAÇÃO CONCLUÍDA! 🎉${NC}"
    echo "================================="
    echo
    systemctl status ligai-dashboard --no-pager -l
    echo
    echo -e "${YELLOW}🌐 URL: https://ligai.primerastreadores.com${NC}"
    echo -e "${YELLOW}📊 Banco: Neon Database${NC}"
    echo -e "${YELLOW}📧 Admin: admin@exemplo.com${NC}"
    echo -e "${YELLOW}🔑 Senha: admin123${NC}"
    
else
    echo -e "${RED}❌ Erro ao iniciar serviço${NC}"
    echo
    echo "Logs de erro:"
    journalctl -u ligai-dashboard --no-pager -l -n 20
    exit 1
fi

echo
echo -e "${GREEN}📋 Comandos úteis:${NC}"
echo "• Ver logs: journalctl -u ligai-dashboard -f"
echo "• Reiniciar: systemctl restart ligai-dashboard"
echo "• Status: systemctl status ligai-dashboard"
echo "• Parar: systemctl stop ligai-dashboard"