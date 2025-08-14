#!/bin/bash

# =============================================================================
# LigAI Dashboard - Configuração de Produção
# =============================================================================
# Script complementar para configurar otimizações específicas de produção
# =============================================================================

set -e

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"; }
warn() { echo -e "${YELLOW}[AVISO] $1${NC}"; }
error() { echo -e "${RED}[ERRO] $1${NC}"; exit 1; }

# Configuração do Node.js para produção
optimize_nodejs() {
    log "Otimizando Node.js para produção..."
    
    # Configurar variáveis de ambiente do Node.js
    cat >> ~/.bashrc << 'EOF'
# Node.js Production Settings
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=2048 --enable-source-maps"
export UV_THREADPOOL_SIZE=128
EOF
    
    source ~/.bashrc
    
    # Configurar limites do sistema
    sudo tee /etc/security/limits.d/nodejs.conf > /dev/null << EOF
# Node.js limits
$USER soft nofile 65536
$USER hard nofile 65536
$USER soft nproc 32768
$USER hard nproc 32768
EOF
    
    log "Node.js otimizado!"
}

# Configurar PostgreSQL para produção
optimize_postgresql() {
    log "Otimizando PostgreSQL para produção..."
    
    # Obter informações do sistema
    TOTAL_MEM=$(free -m | awk 'NR==2{printf "%.0f", $2/1024}')
    CPU_CORES=$(nproc)
    
    # Calcular valores otimizados
    SHARED_BUFFERS=$((TOTAL_MEM / 4))
    EFFECTIVE_CACHE_SIZE=$((TOTAL_MEM * 3 / 4))
    WORK_MEM=$((TOTAL_MEM * 1024 / (4 * CPU_CORES)))
    MAINTENANCE_WORK_MEM=$((TOTAL_MEM / 16))
    
    # Se valores muito baixos, definir mínimos
    [[ $SHARED_BUFFERS -lt 128 ]] && SHARED_BUFFERS=128
    [[ $WORK_MEM -lt 4 ]] && WORK_MEM=4
    [[ $MAINTENANCE_WORK_MEM -lt 64 ]] && MAINTENANCE_WORK_MEM=64
    
    # Criar configuração otimizada
    sudo tee -a /etc/postgresql/*/main/postgresql.conf > /dev/null << EOF

# LigAI Production Optimizations
shared_buffers = ${SHARED_BUFFERS}MB
effective_cache_size = ${EFFECTIVE_CACHE_SIZE}MB
work_mem = ${WORK_MEM}MB
maintenance_work_mem = ${MAINTENANCE_WORK_MEM}MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
max_worker_processes = $CPU_CORES
max_parallel_workers_per_gather = $((CPU_CORES / 2))
max_parallel_workers = $CPU_CORES
max_parallel_maintenance_workers = $((CPU_CORES / 2))

# Connection settings
max_connections = 200
shared_preload_libraries = 'pg_stat_statements'

# Logging
log_statement = 'mod'
log_min_duration_statement = 1000
log_checkpoints = on
log_connections = on
log_disconnections = on
EOF
    
    # Reiniciar PostgreSQL
    sudo systemctl restart postgresql
    
    log "PostgreSQL otimizado! RAM: ${TOTAL_MEM}GB, CPUs: $CPU_CORES"
}

# Configurar cache e compressão no Nginx
optimize_nginx() {
    log "Otimizando Nginx para produção..."
    
    # Configurações globais de otimização
    sudo tee /etc/nginx/conf.d/optimization.conf > /dev/null << 'EOF'
# Gzip Compression
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_comp_level 6;
gzip_types
    text/plain
    text/css
    text/xml
    text/javascript
    application/json
    application/javascript
    application/xml+rss
    application/atom+xml
    image/svg+xml;

# Brotli Compression (se disponível)
# brotli on;
# brotli_comp_level 6;
# brotli_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

# Cache estático
location ~* \.(jpg|jpeg|png|gif|ico|css|js|pdf|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    add_header Vary Accept-Encoding;
    access_log off;
}

# Buffer sizes
client_body_buffer_size 128k;
client_max_body_size 50m;
client_header_buffer_size 1k;
large_client_header_buffers 4 4k;
output_buffers 1 32k;
postpone_output 1460;

# Timeouts
client_body_timeout 12;
client_header_timeout 12;
keepalive_timeout 65;
send_timeout 10;

# Worker processes
worker_processes auto;
worker_connections 1024;
worker_rlimit_nofile 2048;

# Enable sendfile
sendfile on;
tcp_nopush on;
tcp_nodelay on;
EOF
    
    # Testar e recarregar Nginx
    sudo nginx -t && sudo systemctl reload nginx
    
    log "Nginx otimizado!"
}

# Configurar monitoramento básico
setup_monitoring() {
    log "Configurando monitoramento básico..."
    
    # Instalar htop e iotop para monitoramento
    sudo apt install -y htop iotop nethogs
    
    # Script de monitoramento simples
    cat > ~/monitor-ligai.sh << 'EOF'
#!/bin/bash
echo "=== LigAI Dashboard - Status do Sistema ==="
echo "Data: $(date)"
echo ""

echo "--- Aplicação ---"
systemctl is-active ligai && echo "✅ LigAI: Rodando" || echo "❌ LigAI: Parado"
echo "CPU: $(ps -o %cpu= -p $(pgrep -f "node.*server") 2>/dev/null || echo "N/A")%"
echo "Memória: $(ps -o %mem= -p $(pgrep -f "node.*server") 2>/dev/null || echo "N/A")%"

echo ""
echo "--- Banco de Dados ---"
systemctl is-active postgresql && echo "✅ PostgreSQL: Rodando" || echo "❌ PostgreSQL: Parado"

echo ""
echo "--- Web Server ---"
systemctl is-active nginx && echo "✅ Nginx: Rodando" || echo "❌ Nginx: Parado"

echo ""
echo "--- Sistema ---"
echo "Uptime: $(uptime -p)"
echo "Uso de disco: $(df -h / | awk 'NR==2 {print $5}')"
echo "Memória livre: $(free -h | awk 'NR==2{print $7}')"

echo ""
echo "--- Últimos logs da aplicação ---"
journalctl -u ligai -n 5 --no-pager 2>/dev/null || echo "Sem logs disponíveis"
EOF
    
    chmod +x ~/monitor-ligai.sh
    
    # Criar alias úteis
    cat >> ~/.bashrc << 'EOF'

# LigAI aliases
alias ligai-status='~/monitor-ligai.sh'
alias ligai-logs='journalctl -u ligai -f'
alias ligai-restart='sudo systemctl restart ligai'
alias ligai-stop='sudo systemctl stop ligai'
alias ligai-start='sudo systemctl start ligai'
alias nginx-reload='sudo systemctl reload nginx'
alias db-backup='pg_dump ligai > ~/ligai_backup_$(date +%Y%m%d_%H%M%S).sql'
EOF
    
    log "Monitoramento configurado! Use 'ligai-status' para verificar o status."
}

# Configurar backups automáticos
setup_backups() {
    log "Configurando backups automáticos..."
    
    # Criar diretório de backup
    mkdir -p ~/backups/ligai
    
    # Script de backup
    cat > ~/backup-ligai.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="$HOME/backups/ligai"
DATE=$(date +%Y%m%d_%H%M%S)
APP_DIR="$HOME/ligai"

# Criar backup do banco
echo "Fazendo backup do banco de dados..."
pg_dump ligai > "$BACKUP_DIR/db_$DATE.sql"

# Backup dos uploads
echo "Fazendo backup dos uploads..."
tar -czf "$BACKUP_DIR/uploads_$DATE.tar.gz" -C "$APP_DIR" uploads

# Backup da configuração
echo "Fazendo backup da configuração..."
cp "$APP_DIR/.env" "$BACKUP_DIR/env_$DATE.backup"

# Remover backups antigos (manter últimos 7 dias)
find "$BACKUP_DIR" -type f -mtime +7 -delete

echo "Backup concluído: $DATE"
echo "Arquivos criados:"
ls -la "$BACKUP_DIR"/*"$DATE"*
EOF
    
    chmod +x ~/backup-ligai.sh
    
    # Configurar cron para backup diário às 2h
    (crontab -l 2>/dev/null; echo "0 2 * * * $HOME/backup-ligai.sh >> $HOME/backup.log 2>&1") | crontab -
    
    log "Backups automáticos configurados! (diário às 2h)"
}

# Configurar logs estruturados
setup_logging() {
    log "Configurando sistema de logs..."
    
    # Configurar logrotate para aplicação
    sudo tee /etc/logrotate.d/ligai > /dev/null << 'EOF'
/var/log/ligai/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 root root
    postrotate
        systemctl reload ligai 2>/dev/null || true
    endscript
}
EOF
    
    # Criar diretório de logs
    sudo mkdir -p /var/log/ligai
    sudo chown $USER:$USER /var/log/ligai
    
    log "Sistema de logs configurado!"
}

# Configurar swap se necessário
setup_swap() {
    # Verificar se já existe swap
    if swapon --show | grep -q swap; then
        log "Swap já configurado, pulando..."
        return
    fi
    
    log "Configurando arquivo de swap..."
    
    # Criar arquivo de swap de 2GB
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    
    # Tornar permanente
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    
    # Configurar swappiness
    echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
    
    log "Swap de 2GB configurado!"
}

# Configurar fail2ban para segurança
setup_security() {
    log "Configurando segurança adicional..."
    
    # Instalar fail2ban
    sudo apt install -y fail2ban
    
    # Configurar fail2ban para SSH e Nginx
    sudo tee /etc/fail2ban/jail.local > /dev/null << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10
EOF
    
    # Iniciar fail2ban
    sudo systemctl enable fail2ban
    sudo systemctl start fail2ban
    
    log "Fail2ban configurado!"
}

# Configurar otimizações de kernel
optimize_kernel() {
    log "Aplicando otimizações de kernel..."
    
    sudo tee -a /etc/sysctl.conf > /dev/null << 'EOF'

# LigAI Network Optimizations
net.core.rmem_default = 262144
net.core.rmem_max = 16777216
net.core.wmem_default = 262144
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 65536 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
net.ipv4.tcp_congestion_control = bbr
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_window_scaling = 1
net.ipv4.tcp_timestamps = 1
net.ipv4.tcp_sack = 1
net.ipv4.tcp_no_metrics_save = 1
net.ipv4.tcp_moderate_rcvbuf = 1

# File system optimizations
fs.file-max = 65536
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5
EOF
    
    # Aplicar mudanças
    sudo sysctl -p
    
    log "Otimizações de kernel aplicadas!"
}

# Criar script de manutenção
create_maintenance_script() {
    log "Criando scripts de manutenção..."
    
    cat > ~/maintenance-ligai.sh << 'EOF'
#!/bin/bash
echo "=== LigAI Dashboard - Manutenção do Sistema ==="

echo "1. Limpando logs antigos..."
sudo journalctl --vacuum-time=30d

echo "2. Limpando cache do apt..."
sudo apt autoremove -y && sudo apt autoclean

echo "3. Atualizando estatísticas do PostgreSQL..."
sudo -u postgres psql ligai -c "ANALYZE;"

echo "4. Verificando espaço em disco..."
df -h

echo "5. Verificando processos da aplicação..."
ps aux | grep -E "(node|nginx|postgres)" | grep -v grep

echo "6. Status dos serviços..."
systemctl status ligai nginx postgresql --no-pager

echo "Manutenção concluída!"
EOF
    
    chmod +x ~/maintenance-ligai.sh
    
    # Configurar cron para manutenção semanal
    (crontab -l 2>/dev/null; echo "0 3 * * 0 $HOME/maintenance-ligai.sh >> $HOME/maintenance.log 2>&1") | crontab -
    
    log "Script de manutenção criado! Execute com: ~/maintenance-ligai.sh"
}

# Função principal
main() {
    echo ""
    echo "🔧 LigAI Dashboard - Configuração de Produção"
    echo "=============================================="
    echo ""
    
    if [[ ! -f "/etc/systemd/system/ligai.service" ]]; then
        error "Execute primeiro o install-ligai.sh!"
    fi
    
    log "Aplicando otimizações de produção..."
    
    optimize_nodejs
    optimize_postgresql
    optimize_nginx
    setup_swap
    setup_monitoring
    setup_backups
    setup_logging
    setup_security
    optimize_kernel
    create_maintenance_script
    
    echo ""
    echo "=========================================="
    echo "   OTIMIZAÇÃO CONCLUÍDA! 🚀"
    echo "=========================================="
    echo ""
    echo "🔍 Comandos úteis adicionados:"
    echo "• ligai-status      - Status do sistema"
    echo "• ligai-logs        - Logs em tempo real"
    echo "• ligai-restart     - Reiniciar aplicação"
    echo "• ~/backup-ligai.sh - Backup manual"
    echo "• ~/maintenance-ligai.sh - Manutenção do sistema"
    echo ""
    echo "📅 Tarefas automáticas configuradas:"
    echo "• Backup diário às 2h"
    echo "• Manutenção semanal às 3h (domingo)"
    echo "• Rotação de logs (30 dias)"
    echo ""
    echo "🛡️ Segurança:"
    echo "• Fail2ban ativo"
    echo "• Firewall configurado"
    echo "• Limites de sistema otimizados"
    echo ""
    warn "Reinicie o servidor para aplicar todas as otimizações:"
    warn "sudo reboot"
}

main "$@"