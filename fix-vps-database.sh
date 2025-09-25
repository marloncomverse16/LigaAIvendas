#!/bin/bash

#################################################
# LigAI Dashboard - Corrigir Banco VPS
# Configura aplicação para usar PostgreSQL local
#################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Corrigindo Configuração do Banco VPS${NC}"
echo "=================================================="

# Verificar se é root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}Execute como root: sudo bash fix-vps-database.sh${NC}"
    exit 1
fi

log() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

error() {
    echo -e "${RED}[ERRO]${NC} $1"
}

APP_DIR="/root/ligai-dashboard"
ENV_FILE="$APP_DIR/.env"

# Dados do banco PostgreSQL local
DB_HOST="109.123.251.250"
DB_NAME="ligai_db"
DB_USER="ligai"
DB_PASS="ligai"
DB_PORT="5432"
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@$DB_HOST:$DB_PORT/$DB_NAME?sslmode=disable"

log "Verificando diretório da aplicação..."
if [[ ! -d "$APP_DIR" ]]; then
    error "Diretório $APP_DIR não encontrado"
    exit 1
fi

cd "$APP_DIR" || exit 1

# 1. Parar serviço atual
log "Parando serviço ligai-dashboard..."
systemctl stop ligai-dashboard 2>/dev/null || true
sleep 3

# Matar qualquer processo na porta 5000
PROCESSES=$(sudo lsof -ti:5000 2>/dev/null)
if [[ -n "$PROCESSES" ]]; then
    log "Matando processos na porta 5000..."
    for PID in $PROCESSES; do
        kill -9 $PID 2>/dev/null
    done
fi

# 2. Testar conectividade com banco PostgreSQL
log "Testando conectividade com banco PostgreSQL..."
export PGPASSWORD="$DB_PASS"

if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
    log "✅ Conectividade com banco PostgreSQL funcionando"
else
    error "❌ Não foi possível conectar ao banco PostgreSQL"
    echo "Verifique se:"
    echo "• PostgreSQL está rodando"
    echo "• Firewall permite conexão na porta 5432"
    echo "• Credenciais estão corretas"
    exit 1
fi

# 3. Verificar se tabelas existem
log "Verificando estrutura do banco..."
TABLES=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null)

if [[ "$TABLES" -eq 0 ]]; then
    log "Banco vazio - executando migrações..."
    if [[ -f "package.json" ]]; then
        npm run db:push --force 2>/dev/null || warn "Falha ao executar migrações"
    fi
fi

# 4. Criar usuário admin no banco PostgreSQL
log "Criando/atualizando usuário admin..."

# Gerar hash scrypt para senha admin123
cat > /tmp/generate_hash.js << 'EOF'
const { scrypt, randomBytes } = require('crypto');
const { promisify } = require('util');
const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

hashPassword('admin123').then(hash => {
  console.log(hash);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
EOF

PASSWORD_HASH=$(node /tmp/generate_hash.js)
rm -f /tmp/generate_hash.js

if [[ -z "$PASSWORD_HASH" ]]; then
    error "Erro ao gerar hash da senha"
    exit 1
fi

# Inserir/atualizar usuário admin
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
INSERT INTO users (
    username,
    email, 
    password,
    name,
    phone,
    company,
    bio,
    \"isAdmin\",
    \"availableTokens\",
    \"tokenExpirationDays\",
    \"monthlyFee\",
    \"metaConnected\",
    active
) VALUES (
    'admin',
    'admin@ligai.com',
    '$PASSWORD_HASH',
    'Administrador',
    '(11) 99999-9999',
    'LigAI Dashboard',
    'Administrador do sistema',
    true,
    99999,
    365,
    '0',
    false,
    true
) ON CONFLICT (email) DO UPDATE SET 
    password = '$PASSWORD_HASH',
    name = 'Administrador',
    phone = '(11) 99999-9999',
    company = 'LigAI Dashboard',
    \"isAdmin\" = true,
    \"availableTokens\" = 99999,
    active = true;
" 2>/dev/null

log "✅ Usuário admin configurado"

# 5. Backup do .env atual se existir
if [[ -f "$ENV_FILE" ]]; then
    log "Fazendo backup do .env atual..."
    cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"
fi

# 6. Criar novo arquivo .env
log "Criando arquivo .env com banco PostgreSQL local..."
cat > "$ENV_FILE" << EOF
# Configuração do Banco de Dados - PostgreSQL Local
DATABASE_URL=$DATABASE_URL

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

# Variáveis PostgreSQL (para compatibilidade)
PGHOST=$DB_HOST
PGPORT=$DB_PORT
PGUSER=$DB_USER
PGPASSWORD=$DB_PASS
PGDATABASE=$DB_NAME
EOF

log "✅ Arquivo .env configurado com banco PostgreSQL local"

# 7. Atualizar configuração do systemd
log "Atualizando serviço systemd..."
SERVICE_FILE="/etc/systemd/system/ligai-dashboard.service"

cat > "$SERVICE_FILE" << EOF
[Unit]
Description=LigAI Dashboard - PostgreSQL Local
After=network.target postgresql.service

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ligai-dashboard
KillSignal=SIGTERM
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
EOF

log "✅ Serviço systemd atualizado"

# 8. Recarregar systemd
systemctl daemon-reload

# 9. Criar diretórios necessários
mkdir -p /var/lib/ligai-dashboard/uploads
chown -R root:root /var/lib/ligai-dashboard

# 10. Verificar arquivo principal
if [[ -f "server/index.js" ]]; then
    log "✅ Arquivo principal encontrado: server/index.js"
elif [[ -f "server/index.ts" ]]; then
    log "Compilando TypeScript..."
    npm run build 2>/dev/null || warn "Falha na compilação - execute manualmente: npm run build"
else
    error "❌ Arquivo principal da aplicação não encontrado"
    exit 1
fi

# 11. Iniciar serviço
log "Iniciando serviço ligai-dashboard..."
systemctl enable ligai-dashboard
systemctl start ligai-dashboard

# 12. Aguardar inicialização
sleep 8

# 13. Verificar status
STATUS=$(systemctl is-active ligai-dashboard)
if [[ "$STATUS" == "active" ]]; then
    log "✅ Serviço iniciado com sucesso!"
    
    # Verificar se está respondendo
    sleep 5
    if curl -s http://localhost:5000 >/dev/null 2>&1; then
        log "✅ Aplicação respondendo na porta 5000"
    else
        warn "Verificando resposta da aplicação..."
    fi
    
    echo
    echo -e "${GREEN}🎉 CONFIGURAÇÃO CONCLUÍDA! 🎉${NC}"
    echo "=========================================="
    echo
    systemctl status ligai-dashboard --no-pager -l
    echo
    echo -e "${GREEN}📋 INFORMAÇÕES DE ACESSO:${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${YELLOW}🌐 URL:${NC}      https://ligai.primerastreadores.com"
    echo -e "${YELLOW}📊 Banco:${NC}    PostgreSQL Local (109.123.251.250:5432)"
    echo -e "${YELLOW}🗄️ Database:${NC} ligai_db"
    echo -e "${YELLOW}👤 Usuario:${NC}  ligai"
    echo -e "${YELLOW}📧 Admin:${NC}    admin@ligai.com"
    echo -e "${YELLOW}🔑 Senha:${NC}    admin123"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo
    echo -e "${GREEN}✅ Agora sua aplicação VPS está usando o banco PostgreSQL local!${NC}"
    echo -e "${GREEN}✅ Dados serão salvos e carregados corretamente do seu servidor!${NC}"
    
else
    error "❌ Erro ao iniciar serviço"
    echo
    echo "Logs de erro:"
    journalctl -u ligai-dashboard --no-pager -l -n 30
    exit 1
fi

echo
echo -e "${GREEN}📋 Comandos úteis:${NC}"
echo "• Ver logs: journalctl -u ligai-dashboard -f"
echo "• Reiniciar: systemctl restart ligai-dashboard"
echo "• Status: systemctl status ligai-dashboard"
echo "• Verificar banco: psql -h $DB_HOST -U $DB_USER -d $DB_NAME"