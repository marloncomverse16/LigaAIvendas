#!/bin/bash

#################################################
# LigAI Dashboard - Correção do Serviço
# Diagnóstica e corrige problemas do serviço
#################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}LigAI Dashboard - Correção do Serviço${NC}"
echo "=========================================="

# Verificar se é root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}Execute como root: sudo bash fix-service.sh${NC}"
    exit 1
fi

# Função de log
log() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

error() {
    echo -e "${RED}[ERRO]${NC} $1"
}

log "Diagnosticando problema do serviço..."

# Verificar se diretório existe
if [[ ! -d "/opt/ligai" ]]; then
    error "Diretório /opt/ligai não encontrado"
    exit 1
fi

cd /opt/ligai

# Verificar arquivos essenciais
log "Verificando arquivos..."
if [[ ! -f "package.json" ]]; then
    error "package.json não encontrado"
    exit 1
fi

if [[ ! -f ".env" ]]; then
    warn ".env não encontrado, criando..."
    # Criar .env básico
    cat > .env << 'EOF'
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://ligai:ligai123@localhost:5432/ligai_db
SESSION_SECRET=ligai_secret_key_2024
EOF
    chown ligai:ligai .env
fi

# Verificar se build existe
log "Verificando build..."
if [[ ! -d "dist" ]]; then
    log "Build não encontrado, executando build..."
    sudo -u ligai npm run build || {
        error "Falha no build"
        exit 1
    }
fi

# Verificar logs do serviço
log "Verificando logs do serviço..."
if systemctl is-active ligai-dashboard >/dev/null 2>&1; then
    log "Serviço está ativo, verificando logs..."
    journalctl -u ligai-dashboard --no-pager -n 10 || true
else
    warn "Serviço não está ativo"
fi

# Tentar iniciar manualmente para ver erros
log "Testando execução manual..."
sudo -u ligai NODE_ENV=production npm start &
SERVER_PID=$!

# Aguardar alguns segundos
sleep 5

# Verificar se está rodando
if kill -0 $SERVER_PID 2>/dev/null; then
    log "✅ Aplicação iniciou manualmente"
    
    # Testar conectividade
    if curl -s http://localhost:5000 >/dev/null 2>&1; then
        log "✅ Aplicação respondendo na porta 5000"
    else
        warn "Aplicação não responde na porta 5000"
    fi
    
    # Parar processo manual
    kill $SERVER_PID 2>/dev/null || true
else
    error "❌ Falha ao iniciar aplicação manualmente"
fi

# Reiniciar serviço systemd
log "Reiniciando serviço systemd..."
systemctl stop ligai-dashboard 2>/dev/null || true
sleep 2
systemctl start ligai-dashboard

# Verificar status final
sleep 3
if systemctl is-active ligai-dashboard >/dev/null 2>&1; then
    log "✅ Serviço ligai-dashboard está ativo"
    
    # Testar conectividade final
    sleep 2
    if curl -s http://localhost:5000 >/dev/null 2>&1; then
        echo
        echo -e "${GREEN}✅ SERVIÇO CORRIGIDO COM SUCESSO!${NC}"
        echo "Aplicação está rodando em: https://ligai.primerastreadores.com"
        echo
    else
        warn "Serviço ativo mas não responde na porta 5000"
        echo "Verifique os logs: journalctl -u ligai-dashboard -f"
    fi
else
    error "❌ Falha ao iniciar serviço"
    echo "Verifique os logs: journalctl -u ligai-dashboard -f"
fi

echo
log "Diagnóstico concluído"