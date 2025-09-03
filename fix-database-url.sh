#!/bin/bash

#################################################
# LigAI Dashboard - Correção DATABASE_URL
# Corrige problema da variável de ambiente
#################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}LigAI Dashboard - Correção DATABASE_URL${NC}"
echo "=============================================="

# Verificar se é root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}Execute como root: sudo bash fix-database-url.sh${NC}"
    exit 1
fi

log() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"
}

log "Corrigindo problema do DATABASE_URL..."

# Ir para diretório do projeto
cd /opt/ligai || {
    echo -e "${RED}Diretório /opt/ligai não encontrado${NC}"
    exit 1
}

# Verificar se .env existe
if [[ ! -f ".env" ]]; then
    log "Criando arquivo .env..."
    cat > .env << 'EOF'
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://ligai:ligai123@localhost:5432/ligai_db
SESSION_SECRET=ligai_secret_key_2024
EOF
else
    log "Arquivo .env existe, verificando conteúdo..."
fi

# Garantir que DATABASE_URL está no .env
if ! grep -q "DATABASE_URL" .env; then
    log "Adicionando DATABASE_URL ao .env..."
    echo "DATABASE_URL=postgresql://ligai:ligai123@localhost:5432/ligai_db" >> .env
fi

# Definir permissões corretas
chown ligai:ligai .env
chmod 600 .env

log "Conteúdo do .env:"
cat .env

# Corrigir arquivo de serviço systemd para carregar .env
log "Corrigindo serviço systemd..."

cat > /etc/systemd/system/ligai-dashboard.service << 'EOF'
[Unit]
Description=LigAI Dashboard
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=ligai
Group=ligai
WorkingDirectory=/opt/ligai
Environment=NODE_ENV=production
Environment=PORT=5000
Environment=DATABASE_URL=postgresql://ligai:ligai123@localhost:5432/ligai_db
Environment=SESSION_SECRET=ligai_secret_key_2024
EnvironmentFile=-/opt/ligai/.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ligai-dashboard

[Install]
WantedBy=multi-user.target
EOF

# Recarregar systemd
log "Recarregando configuração systemd..."
systemctl daemon-reload

# Parar serviço
log "Parando serviço..."
systemctl stop ligai-dashboard

# Testar comando manualmente primeiro
log "Testando execução manual..."
cd /opt/ligai
export NODE_ENV=production
export PORT=5000
export DATABASE_URL=postgresql://ligai:ligai123@localhost:5432/ligai_db
export SESSION_SECRET=ligai_secret_key_2024

# Testar como usuário ligai
sudo -u ligai -E bash -c 'cd /opt/ligai && NODE_ENV=production DATABASE_URL=postgresql://ligai:ligai123@localhost:5432/ligai_db npm start' &
TEST_PID=$!

# Aguardar alguns segundos
sleep 10

# Verificar se está rodando
if kill -0 $TEST_PID 2>/dev/null; then
    log "✅ Teste manual bem-sucedido"
    
    # Verificar conectividade
    if curl -s http://localhost:5000 >/dev/null 2>&1; then
        log "✅ Aplicação respondendo na porta 5000"
    else
        log "Aplicação rodando mas ainda não responde (normal durante inicialização)"
    fi
    
    # Parar teste
    kill $TEST_PID 2>/dev/null || true
    sleep 2
else
    log "❌ Teste manual falhou, verificando logs..."
fi

# Iniciar serviço official
log "Iniciando serviço systemd..."
systemctl start ligai-dashboard

# Aguardar inicialização
sleep 5

# Verificar status
if systemctl is-active --quiet ligai-dashboard; then
    log "✅ Serviço ligai-dashboard está ativo"
    
    # Aguardar um pouco mais para inicialização completa
    sleep 10
    
    # Testar conectividade
    if curl -s http://localhost:5000 >/dev/null 2>&1; then
        echo
        echo -e "${GREEN}🎉 PROBLEMA RESOLVIDO COM SUCESSO! 🎉${NC}"
        echo
        echo "✅ LigAI Dashboard está funcionando"
        echo "🌐 Acesse: https://ligai.primerastreadores.com"
        echo
    else
        log "Serviço ativo, aguardando inicialização completa..."
        sleep 10
        if curl -s http://localhost:5000 >/dev/null 2>&1; then
            echo
            echo -e "${GREEN}🎉 PROBLEMA RESOLVIDO COM SUCESSO! 🎉${NC}"
            echo "🌐 Acesse: https://ligai.primerastreadores.com"
        else
            echo -e "${YELLOW}Serviço iniciado mas ainda não responde completamente${NC}"
            echo "Aguarde mais alguns minutos ou verifique: journalctl -u ligai-dashboard -f"
        fi
    fi
else
    echo -e "${RED}❌ Serviço ainda não está ativo${NC}"
    echo "Verificando logs de erro:"
    journalctl -u ligai-dashboard --no-pager -n 10
fi

log "Correção concluída"