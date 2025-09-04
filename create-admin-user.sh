#!/bin/bash

#################################################
# LigAI Dashboard - Criar Usuário Administrador
# Insere usuário admin padrão no banco de dados
#################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Criando Usuário Administrador - LigAI Dashboard${NC}"
echo "=================================================="

# Verificar se é root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}Execute como root: sudo bash create-admin-user.sh${NC}"
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

# Verificar se PostgreSQL está rodando
log "Verificando se PostgreSQL está ativo..."
if ! systemctl is-active --quiet postgresql; then
    error "PostgreSQL não está rodando. Execute: sudo systemctl start postgresql"
    exit 1
fi

# Verificar se database ligai existe
log "Verificando database 'ligai'..."
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='ligai';" 2>/dev/null)
if [[ "$DB_EXISTS" != "1" ]]; then
    warn "Database 'ligai' não existe. Criando..."
    sudo -u postgres psql -c "CREATE DATABASE ligai OWNER ligai;" 2>/dev/null || {
        error "Não foi possível criar o database 'ligai'"
        exit 1
    }
    log "✅ Database 'ligai' criado"
fi

# Conectar ao database ligai e criar a tabela users se não existir
log "Verificando estrutura das tabelas..."

# SQL para criar tabela users se não existir
CREATE_TABLE_SQL="
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    nome VARCHAR(255),
    telefone VARCHAR(20),
    plano VARCHAR(50) DEFAULT 'free',
    limite_contatos INTEGER DEFAULT 1000,
    limite_agentes_ia INTEGER DEFAULT 3,
    data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
"

# Executar criação da tabela
sudo -u postgres psql -d ligai -c "$CREATE_TABLE_SQL" 2>/dev/null || {
    error "Não foi possível criar a tabela users"
    exit 1
}

log "✅ Estrutura da tabela users verificada"

# Verificar se usuário admin já existe
log "Verificando se usuário admin já existe..."
ADMIN_EXISTS=$(sudo -u postgres psql -d ligai -tAc "SELECT 1 FROM users WHERE email='admin@ligai.com' OR username='admin';" 2>/dev/null)

if [[ "$ADMIN_EXISTS" == "1" ]]; then
    warn "Usuário admin já existe!"
    echo
    echo "Deseja resetar a senha do usuário admin? (s/n)"
    read -r RESET_PASSWORD
    
    if [[ "$RESET_PASSWORD" =~ ^[Ss]$ ]]; then
        # Hash da senha 'admin123' (bcrypt simplificado para teste)
        # Nota: Em produção, use um hash bcrypt real
        PASSWORD_HASH='$2b$10$rHjmvFKhGjhWVz7k.Sf1PuQ3QQdAWx.JgzV6lKhIrAWkBmRl5BzLK'
        
        sudo -u postgres psql -d ligai -c "
            UPDATE users 
            SET password = '$PASSWORD_HASH', 
                updated_at = CURRENT_TIMESTAMP 
            WHERE email = 'admin@ligai.com';
        " 2>/dev/null || {
            error "Não foi possível resetar a senha do admin"
            exit 1
        }
        
        log "✅ Senha do usuário admin resetada para 'admin123'"
    else
        log "Operação cancelada"
    fi
else
    # Criar usuário admin
    log "Criando usuário administrador..."
    
    # Hash da senha 'admin123' (simples para desenvolvimento)
    # Em produção, isso seria gerado com bcrypt apropriado
    PASSWORD_HASH='$2b$10$rHjmvFKhGjhWVz7k.Sf1PuQ3QQdAWx.JgzV6lKhIrAWkBmRl5BzLK'
    
    # SQL para inserir usuário admin
    INSERT_ADMIN_SQL="
    INSERT INTO users (
        email, 
        username, 
        password, 
        nome, 
        telefone, 
        plano, 
        limite_contatos, 
        limite_agentes_ia,
        data_cadastro,
        created_at, 
        updated_at
    ) VALUES (
        'admin@ligai.com',
        'admin',
        '$PASSWORD_HASH',
        'Administrador',
        '(11) 99999-9999',
        'premium',
        10000,
        50,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    );
    "
    
    # Executar inserção
    sudo -u postgres psql -d ligai -c "$INSERT_ADMIN_SQL" 2>/dev/null || {
        error "Não foi possível criar o usuário admin"
        exit 1
    }
    
    log "✅ Usuário administrador criado com sucesso!"
fi

# Verificar se usuário foi criado corretamente
log "Verificando usuário criado..."
USER_INFO=$(sudo -u postgres psql -d ligai -c "SELECT id, email, username, nome, plano FROM users WHERE email='admin@ligai.com';" 2>/dev/null)

echo
echo -e "${GREEN}🎉 USUÁRIO ADMIN CONFIGURADO! 🎉${NC}"
echo
echo "Informações do usuário admin:"
echo "$USER_INFO"
echo
echo -e "${YELLOW}📋 Credenciais de Acesso:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Email:    admin@ligai.com"
echo "Senha:    admin123"
echo "Nome:     Administrador"
echo "Plano:    Premium"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo -e "${YELLOW}🔐 IMPORTANTE - Segurança:${NC}"
echo "• Altere a senha após o primeiro login"
echo "• Configure um email real para o administrador"
echo "• Considere criar usuários específicos para outros acessos"
echo
echo -e "${GREEN}Agora você pode acessar: https://ligai.primerastreadores.com${NC}"
echo "Use as credenciais acima para fazer login no sistema."

# Mostrar total de usuários
TOTAL_USERS=$(sudo -u postgres psql -d ligai -tAc "SELECT COUNT(*) FROM users;" 2>/dev/null)
log "Total de usuários no sistema: $TOTAL_USERS"

echo
echo -e "${YELLOW}Para verificar todos os usuários:${NC}"
echo "sudo -u postgres psql -d ligai -c \"SELECT id, email, username, nome, plano, data_cadastro FROM users;\""