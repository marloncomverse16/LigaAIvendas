#!/bin/bash

#################################################
# LigAI Dashboard - Instalador VPS Completo
# Sistema automatizado para Ubuntu/Debian
# Versão: 5.0.0 - Reconstruído do zero
# GitHub: https://github.com/marloncomverse16/LigaAIvendas
#################################################

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # Sem cor
BOLD='\033[1m'

# Configurações globais
LIGAI_USER="ligai"
LIGAI_DIR="/opt/ligai"
SERVICE_NAME="ligai-dashboard"
DB_NAME="ligai_db"
GITHUB_REPO="https://github.com/marloncomverse16/LigaAIvendas.git"
GITHUB_ZIP="https://github.com/marloncomverse16/LigaAIvendas/archive/refs/heads/main.zip"
NGINX_CONF="/etc/nginx/sites-available/ligai"
LOG_FILE="/var/log/ligai-install.log"

# Variáveis globais
DOMAIN=""
DB_USER=""
DB_PASS=""
DB_HOST="localhost"
DB_PORT="5432"

# Função de logging
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[AVISO]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERRO]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

# Cabeçalho
show_header() {
    clear
    echo -e "${BLUE}${BOLD}"
    echo "██╗     ██╗ ██████╗  █████╗ ██╗"
    echo "██║     ██║██╔════╝ ██╔══██╗██║"
    echo "██║     ██║██║  ███╗███████║██║"
    echo "██║     ██║██║   ██║██╔══██║██║"
    echo "███████╗██║╚██████╔╝██║  ██║██║"
    echo "╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝"
    echo -e "${NC}"
    echo -e "${BOLD}LigAI Dashboard - Instalador VPS${NC}"
    echo "Versão: 5.0.0 | Sistema: Ubuntu/Debian"
    echo "==============================================="
    echo
}

# Verificação de pré-requisitos
check_prerequisites() {
    log "Verificando pré-requisitos do sistema..."
    
    # Verificar se é root
    if [[ $EUID -ne 0 ]]; then
        error "Este script deve ser executado como root"
    fi

    # Verificar sistema operacional
    if ! command -v apt &> /dev/null; then
        error "Este instalador funciona apenas em sistemas Ubuntu/Debian"
    fi

    # Verificar conexão com internet
    if ! ping -c 1 google.com &> /dev/null; then
        error "Conexão com a internet necessária"
    fi

    log "Pré-requisitos verificados com sucesso"
}

# Atualização do sistema
update_system() {
    log "Atualizando sistema..."
    export DEBIAN_FRONTEND=noninteractive
    apt update -y >> "$LOG_FILE" 2>&1
    apt upgrade -y >> "$LOG_FILE" 2>&1
    apt autoremove -y >> "$LOG_FILE" 2>&1
    log "Sistema atualizado"
}

# Instalação de dependências básicas
install_basic_dependencies() {
    log "Instalando dependências básicas..."
    apt install -y \
        curl \
        wget \
        git \
        unzip \
        build-essential \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release \
        ufw \
        fail2ban \
        htop \
        nano \
        vim \
        supervisor \
        >> "$LOG_FILE" 2>&1 || error "Falha na instalação de dependências básicas"
    log "Dependências básicas instaladas"
}

# Instalação do Node.js
install_nodejs() {
    log "Instalando Node.js 20..."
    
    # Remover completamente versões antigas
    log "Removendo versões antigas do Node.js..."
    apt remove -y nodejs npm nodejs-doc >> "$LOG_FILE" 2>&1 || true
    apt autoremove -y >> "$LOG_FILE" 2>&1 || true
    apt autoclean >> "$LOG_FILE" 2>&1 || true
    
    # Limpar cache de pacotes
    rm -rf /etc/apt/sources.list.d/nodesource.list* >> "$LOG_FILE" 2>&1 || true
    rm -rf /usr/share/keyrings/nodesource.gpg >> "$LOG_FILE" 2>&1 || true
    
    # Atualizar repositórios
    apt update -y >> "$LOG_FILE" 2>&1
    
    # Instalar Node.js 20 via NodeSource com verificação
    log "Configurando repositório NodeSource..."
    curl -fsSL https://deb.nodesource.com/setup_20.x -o /tmp/nodesource_setup.sh >> "$LOG_FILE" 2>&1
    
    if [[ ! -f /tmp/nodesource_setup.sh ]]; then
        error "Falha ao baixar script de instalação do NodeSource"
    fi
    
    # Executar script de setup
    bash /tmp/nodesource_setup.sh >> "$LOG_FILE" 2>&1 || error "Falha na configuração do repositório NodeSource"
    
    # Atualizar novamente
    apt update -y >> "$LOG_FILE" 2>&1
    
    # Instalar nodejs
    log "Instalando Node.js a partir do repositório NodeSource..."
    apt install -y nodejs >> "$LOG_FILE" 2>&1 || error "Falha na instalação do Node.js"
    
    # Verificar se NPM foi incluído, senão instalar separadamente
    if [[ ! -f "/usr/bin/npm" ]]; then
        log "NPM não incluído no pacote, instalando separadamente..."
        apt install -y npm >> "$LOG_FILE" 2>&1 || {
            warn "Falha na instalação do NPM via apt, tentando método alternativo..."
            # Instalar NPM via script oficial
            curl -qL https://www.npmjs.com/install.sh | sh >> "$LOG_FILE" 2>&1 || true
            # Tentar baixar manualmente do GitHub
            if [[ ! -f "/usr/bin/npm" ]]; then
                log "Instalando NPM manualmente..."
                wget -O /tmp/npm.tar.gz https://registry.npmjs.org/npm/-/npm-10.2.4.tgz >> "$LOG_FILE" 2>&1 || true
                if [[ -f "/tmp/npm.tar.gz" ]]; then
                    cd /tmp
                    tar -xzf npm.tar.gz >> "$LOG_FILE" 2>&1 || true
                    if [[ -d "package" ]]; then
                        # Criar script wrapper para NPM
                        cat > /usr/bin/npm << 'EOF'
#!/bin/bash
exec /usr/bin/node /usr/lib/node_modules/npm/bin/npm-cli.js "$@"
EOF
                        chmod +x /usr/bin/npm >> "$LOG_FILE" 2>&1 || true
                        # Copiar módulo npm
                        mkdir -p /usr/lib/node_modules >> "$LOG_FILE" 2>&1 || true
                        cp -r package /usr/lib/node_modules/npm >> "$LOG_FILE" 2>&1 || true
                    fi
                    rm -rf /tmp/npm.tar.gz /tmp/package
                fi
            fi
        }
    fi
    
    # Limpar arquivo temporário
    rm -f /tmp/nodesource_setup.sh
    
    # Atualizar PATH e hash
    export PATH="/usr/bin:/usr/local/bin:$PATH"
    hash -r
    sleep 2
    
    # Aguardar instalação e recarregar variáveis
    sleep 3
    source /etc/environment 2>/dev/null || true
    export PATH="/usr/bin:/usr/local/bin:/bin:/usr/sbin:/sbin:$PATH"
    hash -r
    
    # Verificar instalação com múltiplas tentativas
    local max_attempts=5
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        log "Verificação $attempt/$max_attempts..."
        
        # Verificar se os binários existem
        if [[ -f "/usr/bin/node" ]] && [[ -f "/usr/bin/npm" ]]; then
            # Testar execução
            if /usr/bin/node --version &>/dev/null && /usr/bin/npm --version &>/dev/null; then
                node_version=$(/usr/bin/node --version 2>/dev/null)
                npm_version=$(/usr/bin/npm --version 2>/dev/null)
                
                log "Node.js encontrado: $node_version"
                log "NPM encontrado: $npm_version"
                
                # Verificar se é versão 20 (aceitar v20, v21, v22, etc.)
                if [[ "$node_version" =~ ^v(2[0-9]|[3-9][0-9]) ]]; then
                    log "✅ Node.js instalado com sucesso: $node_version"
                    log "✅ NPM instalado: $npm_version"
                    
                    # Configurar npm
                    /usr/bin/npm config set fund false >> "$LOG_FILE" 2>&1 || true
                    /usr/bin/npm config set audit false >> "$LOG_FILE" 2>&1 || true
                    
                    # Criar links simbólicos se necessário
                    ln -sf /usr/bin/node /usr/local/bin/node 2>/dev/null || true
                    ln -sf /usr/bin/npm /usr/local/bin/npm 2>/dev/null || true
                    
                    return 0
                else
                    warn "Versão incorreta do Node.js: $node_version (necessário v20+)"
                fi
            else
                warn "Binários não executáveis"
            fi
        else
            warn "Binários não encontrados em /usr/bin/"
        fi
        
        if [[ $attempt -eq $max_attempts ]]; then
            # Diagnóstico detalhado
            log "Diagnóstico final:"
            log "- which node: $(which node 2>/dev/null || echo 'não encontrado')"
            log "- which npm: $(which npm 2>/dev/null || echo 'não encontrado')"
            log "- /usr/bin/node existe: $([[ -f /usr/bin/node ]] && echo 'sim' || echo 'não')"
            log "- /usr/bin/npm existe: $([[ -f /usr/bin/npm ]] && echo 'sim' || echo 'não')"
            log "- PATH atual: $PATH"
            
            error "Node.js 20 não foi instalado corretamente após $max_attempts tentativas"
        fi
        
        ((attempt++))
        sleep 5
    done
}

# Instalação do PostgreSQL
install_postgresql() {
    log "Instalando PostgreSQL..."
    apt install -y postgresql postgresql-contrib >> "$LOG_FILE" 2>&1 || error "Falha na instalação do PostgreSQL"
    
    # Iniciar serviços
    systemctl start postgresql >> "$LOG_FILE" 2>&1
    systemctl enable postgresql >> "$LOG_FILE" 2>&1
    
    log "PostgreSQL instalado e iniciado"
}

# Configuração do banco de dados
setup_database() {
    log "Configurando banco de dados..."
    
    # Gerar senha aleatória se não fornecida
    if [[ -z "$DB_PASS" ]]; then
        DB_PASS=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    fi
    
    # Criar usuário e banco
    sudo -u postgres psql << EOF >> "$LOG_FILE" 2>&1
CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASS';
CREATE DATABASE $DB_NAME OWNER $DB_USER;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
ALTER USER $DB_USER CREATEDB;
\q
EOF

    if [[ $? -eq 0 ]]; then
        log "Banco de dados configurado: $DB_NAME"
        log "Usuário: $DB_USER"
        log "Senha: [OCULTA]"
    else
        error "Falha na configuração do banco de dados"
    fi
}

# Instalação do Nginx
install_nginx() {
    log "Instalando Nginx..."
    apt install -y nginx >> "$LOG_FILE" 2>&1 || error "Falha na instalação do Nginx"
    
    systemctl start nginx >> "$LOG_FILE" 2>&1
    systemctl enable nginx >> "$LOG_FILE" 2>&1
    
    log "Nginx instalado e iniciado"
}

# Criação do usuário do sistema
create_system_user() {
    log "Criando usuário do sistema: $LIGAI_USER"
    
    if id "$LIGAI_USER" &>/dev/null; then
        warn "Usuário $LIGAI_USER já existe"
    else
        useradd -m -s /bin/bash "$LIGAI_USER" >> "$LOG_FILE" 2>&1
        log "Usuário $LIGAI_USER criado"
    fi
    
    # Criar diretório da aplicação
    mkdir -p "$LIGAI_DIR"
    chown "$LIGAI_USER:$LIGAI_USER" "$LIGAI_DIR"
    log "Diretório criado: $LIGAI_DIR"
}

# Download e configuração do código
download_ligai_code() {
    log "Baixando código do LigAI Dashboard..."
    
    cd "$LIGAI_DIR" || error "Não foi possível acessar $LIGAI_DIR"
    
    # Tentar Git clone primeiro
    if git clone "$GITHUB_REPO" temp_ligai >> "$LOG_FILE" 2>&1; then
        log "Clone via Git bem-sucedido"
        cp -r temp_ligai/* . >> "$LOG_FILE" 2>&1
        cp -r temp_ligai/.* . >> "$LOG_FILE" 2>&1 || true
        rm -rf temp_ligai
    # Tentar download ZIP como fallback
    elif curl -L --connect-timeout 30 "$GITHUB_ZIP" -o ligai.zip >> "$LOG_FILE" 2>&1 && unzip -q ligai.zip >> "$LOG_FILE" 2>&1; then
        log "Download via ZIP bem-sucedido"
        cp -r LigaAIvendas-main/* . >> "$LOG_FILE" 2>&1
        cp -r LigaAIvendas-main/.* . >> "$LOG_FILE" 2>&1 || true
        rm -rf LigaAIvendas-main ligai.zip
    else
        error "Falha ao baixar código do GitHub. Verifique sua conexão e acesso ao repositório."
    fi
    
    # Verificar se arquivos essenciais foram baixados
    if [[ ! -f "package.json" ]] || [[ ! -f "server/index.ts" ]]; then
        error "Arquivos essenciais não encontrados. Download incompleto."
    fi
    
    # Alterar propriedade dos arquivos
    chown -R "$LIGAI_USER:$LIGAI_USER" "$LIGAI_DIR"
    log "Código baixado e configurado"
}

# Instalação das dependências do projeto
install_project_dependencies() {
    log "Instalando dependências do projeto..."
    
    cd "$LIGAI_DIR" || error "Diretório não encontrado"
    
    # Verificar se package.json existe
    if [[ ! -f "package.json" ]]; then
        error "Arquivo package.json não encontrado em $LIGAI_DIR"
    fi
    
    # Configurar npm para o usuário ligai usando caminho absoluto
    sudo -u "$LIGAI_USER" /usr/bin/npm config set fund false >> "$LOG_FILE" 2>&1 || true
    sudo -u "$LIGAI_USER" /usr/bin/npm config set audit false >> "$LOG_FILE" 2>&1 || true
    
    # Instalar dependências com timeout e retry
    log "Instalando dependências NPM (pode levar alguns minutos)..."
    
    local max_attempts=3
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        log "Tentativa $attempt de $max_attempts..."
        
        # Usar caminho absoluto para npm
        if sudo -u "$LIGAI_USER" /usr/bin/npm install --no-fund --no-audit >> "$LOG_FILE" 2>&1; then
            log "Dependências NPM instaladas com sucesso"
            return 0
        else
            warn "Tentativa $attempt falhou"
            if [[ $attempt -eq $max_attempts ]]; then
                log "Último erro:"
                tail -10 "$LOG_FILE" | grep -E "(error|Error|ERROR)" || true
                error "Falha na instalação das dependências NPM após $max_attempts tentativas"
            fi
            ((attempt++))
            sleep 5
        fi
    done
}

# Configuração das variáveis de ambiente
setup_environment() {
    log "Configurando variáveis de ambiente..."
    
    # DATABASE_URL
    local database_url="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
    
    # Criar arquivo .env
    cat > "$LIGAI_DIR/.env" << EOF
NODE_ENV=production
DATABASE_URL=$database_url
PORT=5000
SESSION_SECRET=$(openssl rand -base64 32)
DOMAIN=$DOMAIN

# WhatsApp APIs
EVOLUTION_API_URL=
EVOLUTION_API_TOKEN=
META_API_TOKEN=
META_VERIFY_TOKEN=

# Configurações opcionais
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
OPENAI_API_KEY=
EOF
    
    chown "$LIGAI_USER:$LIGAI_USER" "$LIGAI_DIR/.env"
    chmod 600 "$LIGAI_DIR/.env"
    
    log "Arquivo .env configurado"
}

# Build da aplicação
build_application() {
    log "Compilando aplicação..."
    
    cd "$LIGAI_DIR" || error "Diretório não encontrado"
    
    # Build como usuário ligai usando caminho absoluto
    log "Executando build da aplicação (pode levar alguns minutos)..."
    
    if sudo -u "$LIGAI_USER" /usr/bin/npm run build >> "$LOG_FILE" 2>&1; then
        log "Aplicação compilada com sucesso"
    else
        log "Erro no build - últimas linhas do log:"
        tail -20 "$LOG_FILE" | grep -E "(error|Error|ERROR|Failed|failed)" || true
        error "Falha no build da aplicação. Verifique o log: $LOG_FILE"
    fi
}

# Configuração do banco de dados (migrations)
setup_database_schema() {
    log "Configurando esquema do banco de dados..."
    
    cd "$LIGAI_DIR" || error "Diretório não encontrado"
    
    # Executar migrations usando caminho absoluto
    log "Executando migrations do banco de dados..."
    
    if sudo -u "$LIGAI_USER" /usr/bin/npm run db:push >> "$LOG_FILE" 2>&1; then
        log "Esquema do banco configurado com sucesso"
    else
        warn "Migration falhou, tentando com --force..."
        if sudo -u "$LIGAI_USER" /usr/bin/npm run db:push -- --force >> "$LOG_FILE" 2>&1; then
            log "Esquema do banco configurado com --force"
        else
            log "Erro na migration - últimas linhas do log:"
            tail -20 "$LOG_FILE" | grep -E "(error|Error|ERROR|Failed|failed)" || true
            error "Falha na configuração do banco de dados. Verifique o log: $LOG_FILE"
        fi
    fi
}

# Configuração do serviço systemd
setup_systemd_service() {
    log "Configurando serviço systemd..."
    
    cat > "/etc/systemd/system/${SERVICE_NAME}.service" << EOF
[Unit]
Description=LigAI Dashboard
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=$LIGAI_USER
Group=$LIGAI_USER
WorkingDirectory=$LIGAI_DIR
Environment=NODE_ENV=production
Environment=PATH=/usr/bin:/usr/local/bin:/bin
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$LIGAI_DIR

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload >> "$LOG_FILE" 2>&1
    systemctl enable "$SERVICE_NAME" >> "$LOG_FILE" 2>&1
    
    log "Serviço systemd configurado"
}

# Configuração do Nginx
setup_nginx_config() {
    log "Configurando Nginx..."
    
    cat > "$NGINX_CONF" << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
    
    # Proxy settings
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }
    
    # WebSocket support
    location /api/ws {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://127.0.0.1:5000;
        expires 1y;
        add_header Cache-Control "public, no-transform";
    }
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;
}
EOF

    # Habilitar site
    ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/ligai >> "$LOG_FILE" 2>&1
    
    # Remover configuração default se existir
    rm -f /etc/nginx/sites-enabled/default >> "$LOG_FILE" 2>&1 || true
    
    # Testar configuração
    nginx -t >> "$LOG_FILE" 2>&1 || error "Configuração do Nginx inválida"
    
    log "Nginx configurado"
}

# Instalação e configuração SSL
setup_ssl_certificate() {
    log "Configurando certificado SSL..."
    
    # Instalar certbot
    apt install -y certbot python3-certbot-nginx >> "$LOG_FILE" 2>&1 || error "Falha na instalação do Certbot"
    
    # Obter certificado
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "admin@$DOMAIN" >> "$LOG_FILE" 2>&1
    
    if [[ $? -eq 0 ]]; then
        log "Certificado SSL configurado para $DOMAIN"
        
        # Configurar renovação automática
        (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab - >> "$LOG_FILE" 2>&1
        log "Renovação automática do SSL configurada"
    else
        warn "Falha na configuração do SSL. Aplicação funcionará apenas com HTTP."
    fi
}

# Configuração do firewall
setup_firewall() {
    log "Configurando firewall..."
    
    ufw --force enable >> "$LOG_FILE" 2>&1
    ufw default deny incoming >> "$LOG_FILE" 2>&1
    ufw default allow outgoing >> "$LOG_FILE" 2>&1
    
    # Regras básicas
    ufw allow ssh >> "$LOG_FILE" 2>&1
    ufw allow 'Nginx Full' >> "$LOG_FILE" 2>&1
    ufw allow 5432 >> "$LOG_FILE" 2>&1  # PostgreSQL
    
    log "Firewall configurado"
}

# Configuração do Fail2Ban
setup_fail2ban() {
    log "Configurando Fail2Ban..."
    
    cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
EOF

    systemctl restart fail2ban >> "$LOG_FILE" 2>&1
    systemctl enable fail2ban >> "$LOG_FILE" 2>&1
    
    log "Fail2Ban configurado"
}

# Iniciar serviços
start_services() {
    log "Iniciando serviços..."
    
    # Recarregar nginx
    systemctl reload nginx >> "$LOG_FILE" 2>&1 || error "Falha ao recarregar Nginx"
    
    # Iniciar aplicação
    systemctl start "$SERVICE_NAME" >> "$LOG_FILE" 2>&1 || error "Falha ao iniciar aplicação"
    
    log "Serviços iniciados"
}

# Verificação da instalação
verify_installation() {
    log "Verificando instalação..."
    
    # Verificar se a aplicação está rodando
    sleep 10
    
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        log "✅ Serviço LigAI Dashboard está ativo"
    else
        error "❌ Falha ao iniciar o serviço"
    fi
    
    # Verificar se o Nginx está funcionando
    if systemctl is-active --quiet nginx; then
        log "✅ Nginx está ativo"
    else
        error "❌ Falha no Nginx"
    fi
    
    # Verificar se a aplicação responde
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:5000 | grep -q "200\|302"; then
        log "✅ Aplicação respondendo na porta 5000"
    else
        warn "⚠️ Aplicação pode não estar respondendo corretamente"
    fi
    
    log "Verificação concluída"
}

# Coleta de informações do usuário
collect_user_input() {
    echo -e "${BOLD}Configuração da instalação:${NC}"
    echo
    
    # Domínio
    while [[ -z "$DOMAIN" ]]; do
        read -p "Digite o domínio (ex: ligai.meudominio.com): " DOMAIN
        if [[ ! "$DOMAIN" =~ ^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$ ]] && [[ ! "$DOMAIN" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$ ]]; then
            echo -e "${RED}Domínio inválido. Tente novamente.${NC}"
            DOMAIN=""
        fi
    done
    
    # Usuário do banco
    while [[ -z "$DB_USER" ]]; do
        read -p "Digite o usuário do banco de dados (padrão: ligai_user): " DB_USER
        DB_USER=${DB_USER:-ligai_user}
    done
    
    # Senha do banco (opcional)
    read -s -p "Digite a senha do banco (Enter para gerar automaticamente): " DB_PASS
    echo
    
    echo
    echo -e "${GREEN}Configuração confirmada:${NC}"
    echo "Domínio: $DOMAIN"
    echo "Usuário DB: $DB_USER"
    echo "Senha DB: [automática se não fornecida]"
    echo
    
    read -p "Continuar com a instalação? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        error "Instalação cancelada pelo usuário"
    fi
}

# Exibir informações finais
show_final_info() {
    clear
    echo -e "${GREEN}${BOLD}"
    echo "██╗     ██╗ ██████╗  █████╗ ██╗"
    echo "██║     ██║██╔════╝ ██╔══██╗██║"
    echo "██║     ██║██║  ███╗███████║██║"
    echo "██║     ██║██║   ██║██╔══██║██║"
    echo "███████╗██║╚██████╔╝██║  ██║██║"
    echo "╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝"
    echo -e "${NC}"
    echo -e "${GREEN}${BOLD}✅ INSTALAÇÃO CONCLUÍDA COM SUCESSO! ✅${NC}"
    echo
    echo -e "${BOLD}Informações do Sistema:${NC}"
    echo "─────────────────────────────────────"
    echo "🌐 URL da aplicação: https://$DOMAIN"
    echo "📁 Diretório: $LIGAI_DIR"
    echo "👤 Usuário do sistema: $LIGAI_USER"
    echo "🗄️ Banco de dados: $DB_NAME"
    echo "👤 Usuário do banco: $DB_USER"
    echo "🔧 Serviço: $SERVICE_NAME"
    echo
    echo -e "${BOLD}Comandos úteis:${NC}"
    echo "─────────────────────────────────────"
    echo "• Verificar status: systemctl status $SERVICE_NAME"
    echo "• Reiniciar aplicação: systemctl restart $SERVICE_NAME"
    echo "• Ver logs: journalctl -u $SERVICE_NAME -f"
    echo "• Verificar Nginx: systemctl status nginx"
    echo "• Log de instalação: $LOG_FILE"
    echo
    echo -e "${BOLD}Próximos passos:${NC}"
    echo "─────────────────────────────────────"
    echo "1. Acesse https://$DOMAIN no navegador"
    echo "2. Registre o primeiro usuário (será admin)"
    echo "3. Configure as APIs do WhatsApp nas configurações"
    echo "4. Configure os agentes de IA conforme necessário"
    echo
    echo -e "${YELLOW}Para suporte técnico:${NC}"
    echo "📧 Email: suporte@ligai.com.br"
    echo "📱 GitHub: https://github.com/marloncomverse16/LigaAIvendas"
    echo
    echo -e "${GREEN}Obrigado por usar o LigAI Dashboard! 🚀${NC}"
}

# Função principal
main() {
    show_header
    
    # Verificações iniciais
    check_prerequisites
    
    # Coleta de informações
    collect_user_input
    
    # Inicializar log
    echo "=== LigAI Dashboard Installation Log ===" > "$LOG_FILE"
    echo "Data: $(date)" >> "$LOG_FILE"
    echo "Domínio: $DOMAIN" >> "$LOG_FILE"
    echo "Usuário DB: $DB_USER" >> "$LOG_FILE"
    echo >> "$LOG_FILE"
    
    # Instalação
    log "Iniciando instalação do LigAI Dashboard..."
    
    update_system
    install_basic_dependencies
    install_nodejs
    install_postgresql
    install_nginx
    create_system_user
    download_ligai_code
    install_project_dependencies
    setup_environment
    build_application
    setup_database
    setup_database_schema
    setup_systemd_service
    setup_nginx_config
    setup_ssl_certificate
    setup_firewall
    setup_fail2ban
    start_services
    verify_installation
    
    log "Instalação concluída!"
    show_final_info
}

# Tratamento de sinais
trap 'error "Instalação interrompida pelo usuário"' INT TERM

# Executar instalação
main "$@"