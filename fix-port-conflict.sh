#!/bin/bash

#################################################
# LigAI Dashboard - Resolver Conflito Porta 5000
# Mata processos conflitantes e inicia serviço
#################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Resolvendo Conflito de Porta 5000${NC}"
echo "=================================================="

log() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"
}

# 1. Parar serviço systemd se estiver tentando rodar
log "Parando serviço ligai-dashboard..."
sudo systemctl stop ligai-dashboard 2>/dev/null
sudo systemctl disable ligai-dashboard 2>/dev/null
sleep 2

# 2. Encontrar todos os processos usando porta 5000
log "Verificando processos na porta 5000..."
PROCESSES=$(sudo lsof -ti:5000 2>/dev/null)

if [[ -n "$PROCESSES" ]]; then
    echo -e "${YELLOW}Processos encontrados na porta 5000:${NC}"
    sudo lsof -i:5000 2>/dev/null
    echo
    
    log "Terminando processos na porta 5000..."
    for PID in $PROCESSES; do
        echo "  - Matando PID: $PID"
        sudo kill -9 $PID 2>/dev/null
    done
    
    sleep 3
    
    # Verificar se ainda há processos
    REMAINING=$(sudo lsof -ti:5000 2>/dev/null)
    if [[ -n "$REMAINING" ]]; then
        echo -e "${RED}❌ Ainda há processos rodando na porta 5000${NC}"
        sudo lsof -i:5000
        exit 1
    else
        log "✅ Porta 5000 liberada!"
    fi
else
    log "✅ Porta 5000 já está livre"
fi

# 3. Verificar se Node.js/npm dev ainda está rodando
log "Verificando processos npm dev..."
NPM_PROCESSES=$(ps aux | grep "npm.*dev\|tsx.*server" | grep -v grep | awk '{print $2}')

if [[ -n "$NPM_PROCESSES" ]]; then
    echo -e "${YELLOW}Processos npm dev encontrados:${NC}"
    ps aux | grep "npm.*dev\|tsx.*server" | grep -v grep
    echo
    
    for PID in $NPM_PROCESSES; do
        echo "  - Matando processo npm/tsx PID: $PID"
        sudo kill -9 $PID 2>/dev/null
    done
    sleep 2
fi

# 4. Limpar possíveis locks
log "Limpando locks e arquivos temporários..."
sudo rm -f /tmp/.pm2-* 2>/dev/null
sudo rm -f /var/lib/ligai-dashboard/*.pid 2>/dev/null

# 5. Verificar se systemd está configurado corretamente
SERVICE_FILE="/etc/systemd/system/ligai-dashboard.service"
if [[ ! -f "$SERVICE_FILE" ]]; then
    echo -e "${RED}❌ Arquivo de serviço systemd não encontrado${NC}"
    echo "Criando serviço systemd..."
    
    sudo tee "$SERVICE_FILE" > /dev/null << 'EOF'
[Unit]
Description=LigAI Dashboard
After=network.target postgresql.service

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=/root/ligai-dashboard
Environment=NODE_ENV=production
Environment=PORT=5000
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ligai-dashboard

[Install]
WantedBy=multi-user.target
EOF
fi

# 6. Recarregar systemd
log "Recarregando configuração systemd..."
sudo systemctl daemon-reload

# 7. Verificar novamente se porta está livre
log "Verificação final da porta..."
if sudo lsof -i:5000 >/dev/null 2>&1; then
    echo -e "${RED}❌ Porta 5000 ainda ocupada!${NC}"
    sudo lsof -i:5000
    exit 1
fi

# 8. Tentar iniciar o serviço
log "Iniciando serviço ligai-dashboard..."
sudo systemctl enable ligai-dashboard
sudo systemctl start ligai-dashboard

# 9. Aguardar inicialização
sleep 5

# 10. Verificar status
STATUS=$(sudo systemctl is-active ligai-dashboard)
if [[ "$STATUS" == "active" ]]; then
    log "✅ Serviço iniciado com sucesso!"
    
    echo
    echo -e "${GREEN}🎉 PROBLEMA RESOLVIDO! 🎉${NC}"
    echo "================================="
    echo
    sudo systemctl status ligai-dashboard --no-pager -l
    echo
    
    # Verificar se está respondendo
    sleep 3
    if curl -s http://localhost:5000 >/dev/null; then
        log "✅ Aplicação respondendo na porta 5000"
        echo
        echo -e "${YELLOW}🌐 Acesse: https://ligai.primerastreadores.com${NC}"
        echo -e "${YELLOW}📧 Login: admin@ligai.com${NC}"
        echo -e "${YELLOW}🔑 Senha: admin123${NC}"
    else
        echo -e "${RED}❌ Aplicação não está respondendo${NC}"
    fi
    
else
    echo -e "${RED}❌ Serviço falhou ao iniciar${NC}"
    echo
    echo "Logs de erro:"
    sudo journalctl -u ligai-dashboard --no-pager -l -n 20
    exit 1
fi

# 11. Status final
echo
echo -e "${GREEN}📊 STATUS FINAL:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Serviço: $(sudo systemctl is-active ligai-dashboard)"
echo "Porta:   $(sudo lsof -ti:5000 >/dev/null && echo 'Em uso pelo serviço' || echo 'Livre')"
echo "URL:     https://ligai.primerastreadores.com"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"