#!/bin/bash

#################################################
# LigAI Dashboard - Verificar Estrutura de Login
# Analisa como o sistema autentica usuários
#################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Verificação - Estrutura de Login${NC}"
echo "=================================================="

echo -e "${YELLOW}1. Usuários existentes na tabela users:${NC}"
sudo -u postgres psql -d ligai_db -c "
SELECT 
    id, 
    username, 
    email, 
    LEFT(password, 20) || '...' AS password_preview,
    name,
    phone,
    company
FROM users 
ORDER BY id;
" 2>&1

echo
echo -e "${YELLOW}2. Verificando se existem outras tabelas de usuário:${NC}"
sudo -u postgres psql -d ligai_db -c "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%user%'
ORDER BY table_name;
" 2>&1

echo
echo -e "${YELLOW}3. Todas as tabelas no banco:${NC}"
sudo -u postgres psql -d ligai_db -c "\dt" 2>&1

echo
echo -e "${YELLOW}4. Testando diferentes formatos de hash de senha:${NC}"

# Testa diferentes hashes para 'admin123'
declare -a HASHES=(
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'  # bcrypt padrão
    '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'  # bcrypt PHP
    '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8'      # SHA256
    'admin123'                                                           # Texto puro
)

for i in "${!HASHES[@]}"; do
    echo "Testando hash formato $((i+1)): ${HASHES[$i]:0:30}..."
    sudo -u postgres psql -d ligai_db -c "
        UPDATE users 
        SET password = '${HASHES[$i]}' 
        WHERE email = 'admin@ligai.com';
    " >/dev/null 2>&1
    
    echo "Hash atualizado. Teste login agora no dashboard."
    echo "Aperte ENTER para testar próximo formato ou CTRL+C para parar"
    read -r
done

echo
echo -e "${YELLOW}5. Verificando configuração final:${NC}"
sudo -u postgres psql -d ligai_db -c "
SELECT 
    id, 
    username, 
    email, 
    name,
    LEFT(password, 50) AS current_password
FROM users 
WHERE email = 'admin@ligai.com';
" 2>&1

echo
echo -e "${GREEN}Informações para Debug:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "• URL: https://ligai.primerastreadores.com"
echo "• Email: admin@ligai.com" 
echo "• Senha: admin123"
echo "• Username: admin"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo -e "${YELLOW}Próximos passos:${NC}"
echo "1. Verifique os logs de erro no dashboard"
echo "2. Teste cada formato de hash acima"
echo "3. Verifique se há middleware de autenticação específico"