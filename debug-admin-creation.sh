#!/bin/bash

#################################################
# LigAI Dashboard - Debug Criação Admin
# Versão com logs detalhados para debug
#################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Debug - Criação Usuário Admin${NC}"
echo "=================================================="

# Verificar estrutura da tabela users
echo -e "${YELLOW}1. Verificando estrutura atual da tabela users...${NC}"
sudo -u postgres psql -d ligai_db -c "\d users" 2>&1

echo
echo -e "${YELLOW}2. Tentando inserir usuário admin com debug...${NC}"

# Hash bcrypt real para 'admin123' (gerado com bcrypt online)
PASSWORD_HASH='$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'

# SQL com debug
INSERT_SQL="
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

echo "SQL que será executado:"
echo "$INSERT_SQL"
echo

# Executar com output completo
echo -e "${YELLOW}3. Executando inserção...${NC}"
RESULT=$(sudo -u postgres psql -d ligai_db -c "$INSERT_SQL" 2>&1)
EXIT_CODE=$?

echo "Resultado da execução:"
echo "$RESULT"
echo "Exit code: $EXIT_CODE"

if [[ $EXIT_CODE -eq 0 ]]; then
    echo -e "${GREEN}✅ Usuário admin criado com sucesso!${NC}"
else
    echo -e "${RED}❌ Erro na criação do usuário${NC}"
    
    # Verificar se é erro de duplicata
    if echo "$RESULT" | grep -q "duplicate key value violates unique constraint"; then
        echo -e "${YELLOW}⚠️ Usuário já existe. Vamos atualizar...${NC}"
        
        UPDATE_SQL="
        UPDATE users 
        SET password = '$PASSWORD_HASH',
            nome = 'Administrador',
            plano = 'premium',
            limite_contatos = 10000,
            limite_agentes_ia = 50,
            updated_at = CURRENT_TIMESTAMP
        WHERE email = 'admin@ligai.com' OR username = 'admin';
        "
        
        echo "Executando update..."
        UPDATE_RESULT=$(sudo -u postgres psql -d ligai_db -c "$UPDATE_SQL" 2>&1)
        UPDATE_EXIT_CODE=$?
        
        echo "Resultado do update:"
        echo "$UPDATE_RESULT"
        echo "Exit code: $UPDATE_EXIT_CODE"
        
        if [[ $UPDATE_EXIT_CODE -eq 0 ]]; then
            echo -e "${GREEN}✅ Usuário admin atualizado com sucesso!${NC}"
        else
            echo -e "${RED}❌ Erro na atualização do usuário${NC}"
        fi
    fi
fi

echo
echo -e "${YELLOW}4. Verificando usuários existentes...${NC}"
sudo -u postgres psql -d ligai_db -c "SELECT id, email, username, nome, plano, created_at FROM users;" 2>&1

echo
echo -e "${YELLOW}5. Verificando constrains da tabela...${NC}"
sudo -u postgres psql -d ligai_db -c "
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    conkey AS constraint_columns
FROM pg_constraint 
WHERE conrelid = 'users'::regclass;
" 2>&1

echo
echo -e "${YELLOW}6. Verificando índices da tabela...${NC}"
sudo -u postgres psql -d ligai_db -c "
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'users';
" 2>&1