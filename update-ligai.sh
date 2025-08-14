#!/bin/bash

# =============================================================================
# LigAI Dashboard - Script de Atualização
# =============================================================================
# Este script atualiza uma instalação existente do LigAI Dashboard
# Mantém configurações, dados e faz backup antes das mudanças
# =============================================================================

set -e

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"; }
warn() { echo -e "${YELLOW}[AVISO] $1${NC}"; }
error() { echo -e "${RED}[ERRO] $1${NC}"; exit 1; }
info() { echo -e "${BLUE}[INFO] $1${NC}"; }

# Configurações padrão
INSTALL_DIR="/home/$USER/ligai"
BACKUP_DIR="/home/$USER/backups/ligai"
SERVICE_NAME="ligai"

# Verificar se a instalação existe
check_installation() {
    log "Verificando instalação existente..."
    
    if [[ ! -d "$INSTALL_DIR" ]]; then
        error "Instalação não encontrada em $INSTALL_DIR. Execute install-ligai.sh primeiro."
    fi
    
    if [[ ! -f "/etc/systemd/system/$SERVICE_NAME.service" ]]; then
        error "Serviço $SERVICE_NAME não encontrado. Execute install-ligai.sh primeiro."
    fi
    
    if [[ ! -f "$INSTALL_DIR/.env" ]]; then
        error "Arquivo .env não encontrado. Instalação incompleta."
    fi
    
    log "Instalação existente verificada!"
}

# Fazer backup completo
create_backup() {
    log "Criando backup antes da atualização..."
    
    mkdir -p "$BACKUP_DIR"
    
    local TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    local BACKUP_NAME="update_backup_$TIMESTAMP"
    
    # Parar aplicação
    log "Parando aplicação..."
    sudo systemctl stop $SERVICE_NAME
    
    # Backup do código
    log "Fazendo backup do código..."
    cp -r "$INSTALL_DIR" "$BACKUP_DIR/$BACKUP_NAME"
    
    # Backup do banco de dados
    log "Fazendo backup do banco de dados..."
    if [[ -f "$INSTALL_DIR/.env" ]]; then
        source "$INSTALL_DIR/.env"
        DB_NAME=$(echo "$DATABASE_URL" | sed 's/.*\///g' | sed 's/?.*//')
        if [[ -n "$DB_NAME" ]]; then
            pg_dump "$DB_NAME" > "$BACKUP_DIR/db_$TIMESTAMP.sql"
            log "Backup do banco '$DB_NAME' criado!"
        fi
    fi
    
    # Backup das configurações do sistema
    log "Fazendo backup das configurações..."
    sudo cp /etc/systemd/system/$SERVICE_NAME.service "$BACKUP_DIR/service_$TIMESTAMP.backup" 2>/dev/null || true
    sudo cp /etc/nginx/sites-available/* "$BACKUP_DIR/" 2>/dev/null || true
    
    log "Backup completo criado em: $BACKUP_DIR/$BACKUP_NAME"
    echo "$BACKUP_NAME" > "$BACKUP_DIR/latest_backup.txt"
}

# Obter código atualizado
update_code() {
    log "Atualizando código da aplicação..."
    
    cd "$INSTALL_DIR"
    
    # Se existe git, fazer pull
    if [[ -d ".git" ]]; then
        log "Atualizando via Git..."
        git fetch origin
        git pull origin main || git pull origin master
    else
        warn "Repositório Git não encontrado. Código deve ser atualizado manualmente."
        warn "Para ativar atualizações automáticas, inicialize o repositório:"
        warn "cd $INSTALL_DIR && git init && git remote add origin SEU_REPOSITORIO"
        return
    fi
    
    log "Código atualizado!"
}

# Atualizar dependências
update_dependencies() {
    log "Atualizando dependências..."
    
    cd "$INSTALL_DIR"
    
    # Verificar se package.json mudou
    if [[ -f "package.json" ]]; then
        log "Instalando/atualizando dependências npm..."
        npm install
        
        # Se existe package-lock.json, usar npm ci para instalação limpa
        if [[ -f "package-lock.json" ]]; then
            npm ci --only=production
        fi
    fi
    
    log "Dependências atualizadas!"
}

# Executar migrações do banco
run_migrations() {
    log "Executando migrações do banco de dados..."
    
    cd "$INSTALL_DIR"
    
    # Verificar se existe sistema de migração
    if npm list drizzle-kit &> /dev/null; then
        log "Executando migrações com Drizzle..."
        npm run db:push
    elif [[ -f "migrations" ]]; then
        log "Executando migrações personalizadas..."
        # Aqui você pode adicionar lógica específica para suas migrações
        warn "Migrações personalizadas detectadas - execute manualmente se necessário"
    else
        info "Nenhum sistema de migração detectado."
    fi
    
    log "Migrações concluídas!"
}

# Fazer build da aplicação
build_application() {
    log "Fazendo build da aplicação..."
    
    cd "$INSTALL_DIR"
    
    # Se existe script de build
    if npm run --silent | grep -q "build"; then
        log "Executando build de produção..."
        npm run build
    else
        info "Script de build não encontrado, pulando..."
    fi
    
    log "Build concluído!"
}

# Atualizar configurações do sistema
update_system_configs() {
    log "Verificando configurações do sistema..."
    
    # Verificar se serviço precisa ser atualizado
    if [[ -f "$INSTALL_DIR/ligai.service.template" ]]; then
        warn "Template de serviço encontrado. Atualize manualmente se necessário:"
        warn "sudo cp $INSTALL_DIR/ligai.service.template /etc/systemd/system/$SERVICE_NAME.service"
        warn "sudo systemctl daemon-reload"
    fi
    
    # Verificar configuração do Nginx
    if [[ -f "$INSTALL_DIR/nginx.conf.template" ]]; then
        warn "Template do Nginx encontrado. Atualize manualmente se necessário:"
        warn "sudo cp $INSTALL_DIR/nginx.conf.template /etc/nginx/sites-available/SEU_DOMINIO"
        warn "sudo nginx -t && sudo systemctl reload nginx"
    fi
    
    # Recarregar daemon se necessário
    sudo systemctl daemon-reload
    
    log "Configurações verificadas!"
}

# Executar testes básicos
run_tests() {
    log "Executando testes básicos..."
    
    cd "$INSTALL_DIR"
    
    # Verificar sintaxe do código
    if command -v node &> /dev/null; then
        log "Verificando sintaxe do Node.js..."
        if [[ -f "server/index.ts" ]]; then
            npx tsc --noEmit --skipLibCheck || warn "Avisos de TypeScript encontrados"
        fi
    fi
    
    # Verificar configuração do Nginx
    log "Verificando configuração do Nginx..."
    sudo nginx -t
    
    # Verificar conexão com banco
    log "Verificando conexão com banco de dados..."
    if [[ -f ".env" ]]; then
        source .env
        if [[ -n "$DATABASE_URL" ]]; then
            DB_NAME=$(echo "$DATABASE_URL" | sed 's/.*\///g' | sed 's/?.*//')
            sudo -u postgres psql -d "$DB_NAME" -c "SELECT 1;" > /dev/null && log "Conexão com banco OK!" || warn "Problema na conexão com banco"
        fi
    fi
    
    log "Testes básicos concluídos!"
}

# Iniciar aplicação
start_application() {
    log "Iniciando aplicação..."
    
    # Iniciar serviço
    sudo systemctl start $SERVICE_NAME
    
    # Aguardar inicialização
    sleep 5
    
    # Verificar status
    if sudo systemctl is-active --quiet $SERVICE_NAME; then
        log "Aplicação iniciada com sucesso!"
        
        # Verificar se responde na porta
        if [[ -f "$INSTALL_DIR/.env" ]]; then
            source "$INSTALL_DIR/.env"
            if [[ -n "$PORT" ]] && curl -s "http://localhost:$PORT/api/health" > /dev/null 2>&1; then
                log "Aplicação respondendo na porta $PORT!"
            fi
        fi
    else
        error "Falha ao iniciar aplicação. Verifique os logs: sudo journalctl -u $SERVICE_NAME -f"
    fi
}

# Verificar saúde pós-atualização
health_check() {
    log "Verificando saúde da aplicação..."
    
    # Status dos serviços
    echo "Status dos serviços:"
    sudo systemctl status $SERVICE_NAME --no-pager -l
    sudo systemctl status nginx --no-pager -l
    sudo systemctl status postgresql --no-pager -l
    
    # Uso de recursos
    echo ""
    echo "Uso de recursos:"
    echo "CPU: $(ps -o %cpu= -p $(pgrep -f "node.*server") 2>/dev/null || echo "N/A")%"
    echo "Memória: $(ps -o %mem= -p $(pgrep -f "node.*server") 2>/dev/null || echo "N/A")%"
    echo "Espaço em disco: $(df -h / | awk 'NR==2 {print $5}')"
    
    # Logs recentes
    echo ""
    echo "Últimos logs da aplicação:"
    sudo journalctl -u $SERVICE_NAME -n 10 --no-pager
    
    log "Verificação de saúde concluída!"
}

# Limpeza pós-atualização
cleanup() {
    log "Executando limpeza..."
    
    cd "$INSTALL_DIR"
    
    # Remover node_modules antigos se necessário
    if [[ -d "node_modules.old" ]]; then
        rm -rf node_modules.old
    fi
    
    # Limpar cache npm
    npm cache clean --force > /dev/null 2>&1 || true
    
    # Remover arquivos temporários
    find . -name "*.tmp" -type f -delete 2>/dev/null || true
    find . -name ".DS_Store" -type f -delete 2>/dev/null || true
    
    log "Limpeza concluída!"
}

# Rollback em caso de erro
rollback() {
    error "Erro durante atualização. Iniciando rollback..."
    
    if [[ -f "$BACKUP_DIR/latest_backup.txt" ]]; then
        local BACKUP_NAME=$(cat "$BACKUP_DIR/latest_backup.txt")
        local BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
        
        if [[ -d "$BACKUP_PATH" ]]; then
            log "Restaurando backup: $BACKUP_NAME"
            
            # Parar aplicação
            sudo systemctl stop $SERVICE_NAME || true
            
            # Restaurar código
            rm -rf "$INSTALL_DIR"
            cp -r "$BACKUP_PATH" "$INSTALL_DIR"
            
            # Iniciar aplicação
            sudo systemctl start $SERVICE_NAME
            
            warn "Rollback concluído. Aplicação restaurada para versão anterior."
            warn "Verifique os logs para identificar o problema: sudo journalctl -u $SERVICE_NAME -f"
        else
            error "Backup não encontrado: $BACKUP_PATH"
        fi
    else
        error "Informações de backup não encontradas!"
    fi
}

# Menu de opções
show_menu() {
    echo ""
    echo "=========================================="
    echo "   LIGAI DASHBOARD - ATUALIZAÇÃO"
    echo "=========================================="
    echo ""
    echo "Escolha o tipo de atualização:"
    echo ""
    echo "1) Atualização Completa (recomendado)"
    echo "2) Apenas Código (Git pull)"
    echo "3) Apenas Dependências (npm install)"
    echo "4) Apenas Migrações de Banco"
    echo "5) Apenas Build da Aplicação"
    echo "6) Verificação de Saúde"
    echo "7) Rollback para Versão Anterior"
    echo "8) Sair"
    echo ""
    read -p "Digite sua opção (1-8): " choice
    
    case $choice in
        1) full_update ;;
        2) code_only_update ;;
        3) dependencies_only_update ;;
        4) migrations_only_update ;;
        5) build_only_update ;;
        6) health_check ;;
        7) rollback ;;
        8) exit 0 ;;
        *) warn "Opção inválida!" && show_menu ;;
    esac
}

# Atualização completa
full_update() {
    log "Iniciando atualização completa..."
    
    check_installation
    create_backup
    update_code
    update_dependencies
    run_migrations
    build_application
    update_system_configs
    run_tests
    start_application
    cleanup
    health_check
    
    echo ""
    log "🎉 Atualização completa concluída com sucesso!"
    log "Aplicação está rodando na versão mais recente."
}

# Apenas código
code_only_update() {
    log "Atualizando apenas código..."
    check_installation
    sudo systemctl stop $SERVICE_NAME
    update_code
    build_application
    start_application
    log "✅ Código atualizado!"
}

# Apenas dependências
dependencies_only_update() {
    log "Atualizando apenas dependências..."
    check_installation
    sudo systemctl stop $SERVICE_NAME
    update_dependencies
    build_application
    start_application
    log "✅ Dependências atualizadas!"
}

# Apenas migrações
migrations_only_update() {
    log "Executando apenas migrações..."
    check_installation
    run_migrations
    log "✅ Migrações executadas!"
}

# Apenas build
build_only_update() {
    log "Fazendo apenas build..."
    check_installation
    sudo systemctl stop $SERVICE_NAME
    build_application
    start_application
    log "✅ Build concluído!"
}

# Configurar trap para rollback em caso de erro
trap rollback ERR

# Função principal
main() {
    # Se não há argumentos, mostrar menu
    if [[ $# -eq 0 ]]; then
        show_menu
    else
        case $1 in
            --full|-f)
                full_update
                ;;
            --code|-c)
                code_only_update
                ;;
            --deps|-d)
                dependencies_only_update
                ;;
            --migrations|-m)
                migrations_only_update
                ;;
            --build|-b)
                build_only_update
                ;;
            --health|-h)
                health_check
                ;;
            --rollback|-r)
                rollback
                ;;
            --help)
                echo "Uso: $0 [opção]"
                echo ""
                echo "Opções:"
                echo "  --full, -f         Atualização completa"
                echo "  --code, -c         Apenas código"
                echo "  --deps, -d         Apenas dependências"
                echo "  --migrations, -m   Apenas migrações"
                echo "  --build, -b        Apenas build"
                echo "  --health, -h       Verificação de saúde"
                echo "  --rollback, -r     Rollback"
                echo "  --help             Esta mensagem"
                echo ""
                echo "Sem argumentos: menu interativo"
                ;;
            *)
                error "Opção inválida: $1. Use --help para ver opções disponíveis."
                ;;
        esac
    fi
}

# Executar função principal
main "$@"