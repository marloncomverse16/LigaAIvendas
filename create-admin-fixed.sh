#!/bin/bash

#################################################
# LigAI Dashboard - Criar Admin (Estrutura Correta)
# Usa a estrutura real da tabela users
#################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Criando Usuário Admin - Estrutura Correta${NC}"
echo "=================================================="

# Verificar se é root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}Execute como root: sudo bash create-admin-fixed.sh${NC}"
    exit 1
fi

log() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERRO]${NC} $1"
}

# Verificar se PostgreSQL está rodando
log "Verificando PostgreSQL..."
if ! systemctl is-active --quiet postgresql; then
    error "PostgreSQL não está rodando"
    exit 1
fi

# Hash bcrypt simples para 'admin123'
PASSWORD_HASH='$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'

# Verificar se usuário admin já existe
log "Verificando se admin já existe..."
ADMIN_EXISTS=$(sudo -u postgres psql -d ligai_db -tAc "SELECT id FROM users WHERE email='admin@ligai.com' OR username='admin';" 2>/dev/null)

if [[ -n "$ADMIN_EXISTS" ]]; then
    log "Usuário admin já existe (ID: $ADMIN_EXISTS). Atualizando..."
    
    # Atualizar usuário existente
    UPDATE_SQL="
    UPDATE users 
    SET 
        password = '$PASSWORD_HASH',
        name = 'Administrador',
        email = 'admin@ligai.com',
        username = 'admin',
        phone = '(11) 99999-9999',
        company = 'LigAI Dashboard',
        bio = 'Usuário administrador do sistema',
        available_tokens = 99999,
        monthly_fee = '0'
    WHERE email = 'admin@ligai.com' OR username = 'admin';
    "
    
    RESULT=$(sudo -u postgres psql -d ligai_db -c "$UPDATE_SQL" 2>&1)
    EXIT_CODE=$?
    
    if [[ $EXIT_CODE -eq 0 ]]; then
        log "✅ Usuário admin atualizado com sucesso!"
    else
        error "Falha na atualização: $RESULT"
        exit 1
    fi
else
    log "Criando novo usuário admin..."
    
    # Inserir novo usuário usando campos corretos
    INSERT_SQL="
    INSERT INTO users (
        username,
        email,
        password,
        name,
        phone,
        company,
        bio,
        available_tokens,
        token_expiration_days,
        monthly_fee,
        meta_connected
    ) VALUES (
        'admin',
        'admin@ligai.com',
        '$PASSWORD_HASH',
        'Administrador',
        '(11) 99999-9999',
        'LigAI Dashboard',
        'Usuário administrador do sistema',
        99999,
        365,
        '0',
        false
    );
    "
    
    RESULT=$(sudo -u postgres psql -d ligai_db -c "$INSERT_SQL" 2>&1)
    EXIT_CODE=$?
    
    if [[ $EXIT_CODE -eq 0 ]]; then
        log "✅ Usuário admin criado com sucesso!"
    else
        error "Falha na criação: $RESULT"
        
        # Se for erro de duplicata, tentar update
        if echo "$RESULT" | grep -q "duplicate key value violates unique constraint"; then
            log "Tentando atualizar usuário existente..."
            UPDATE_SQL="
            UPDATE users 
            SET 
                password = '$PASSWORD_HASH',
                name = 'Administrador',
                phone = '(11) 99999-9999',
                company = 'LigAI Dashboard',
                bio = 'Usuário administrador do sistema',
                available_tokens = 99999
            WHERE email = 'admin@ligai.com' OR username = 'admin';
            "
            
            UPDATE_RESULT=$(sudo -u postgres psql -d ligai_db -c "$UPDATE_SQL" 2>&1)
            if [[ $? -eq 0 ]]; then
                log "✅ Usuário admin atualizado após erro de duplicata!"
            else
                error "Falha na atualização: $UPDATE_RESULT"
                exit 1
            fi
        else
            exit 1
        fi
    fi
fi

# Verificar resultado final
log "Verificando usuário criado..."
USER_INFO=$(sudo -u postgres psql -d ligai_db -c "
    SELECT 
        id, 
        username, 
        email, 
        name, 
        phone, 
        company,
        available_tokens
    FROM users 
    WHERE email = 'admin@ligai.com';
" 2>&1)

echo
echo -e "${GREEN}🎉 USUÁRIO ADMIN CONFIGURADO! 🎉${NC}"
echo
echo "Informações do usuário:"
echo "$USER_INFO"
echo
echo -e "${YELLOW}📋 Credenciais de Login:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Email:    admin@ligai.com"
echo "Senha:    admin123"
echo "Username: admin"
echo "Nome:     Administrador"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo -e "${GREEN}Acesse: https://ligai.primerastreadores.com${NC}"
echo
echo -e "${YELLOW}IMPORTANTE:${NC}"
echo "• Altere a senha após o primeiro login"
echo "• Configure as URLs de webhook conforme necessário"
echo "• O usuário tem tokens ilimitados (99999)"

# Contar total de usuários
TOTAL_USERS=$(sudo -u postgres psql -d ligai_db -tAc "SELECT COUNT(*) FROM users;" 2>/dev/null)
log "Total de usuários no sistema: $TOTAL_USERS"