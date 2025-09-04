#!/bin/bash

#################################################
# LigAI Dashboard - Criar Admin com SCRYPT Hash
# Usa o mesmo algoritmo que o sistema (scrypt)
#################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Criando Admin - Hash SCRYPT Correto${NC}"
echo "=================================================="

log() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"
}

# Gerar hash scrypt para 'admin123' usando Node.js
log "Gerando hash scrypt para senha 'admin123'..."

# Script Node.js para gerar hash compatível
cat > /tmp/generate_hash.js << 'EOF'
const { scrypt, randomBytes } = require('crypto');
const { promisify } = require('util');

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

hashPassword('admin123').then(hash => {
  console.log(hash);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
EOF

# Gerar hash usando Node.js
PASSWORD_HASH=$(node /tmp/generate_hash.js)
rm -f /tmp/generate_hash.js

if [[ -z "$PASSWORD_HASH" ]]; then
    echo -e "${RED}❌ Erro ao gerar hash da senha${NC}"
    exit 1
fi

log "Hash gerado: ${PASSWORD_HASH:0:50}..."

# Verificar se usuário admin existe
log "Verificando usuário admin..."
ADMIN_EXISTS=$(sudo -u postgres psql -d ligai_db -tAc "SELECT id FROM users WHERE email='admin@ligai.com';" 2>/dev/null)

if [[ -n "$ADMIN_EXISTS" ]]; then
    log "Atualizando usuário admin existente (ID: $ADMIN_EXISTS)..."
    
    UPDATE_SQL="
    UPDATE users 
    SET 
        password = '$PASSWORD_HASH',
        name = 'Administrador',
        phone = '(11) 99999-9999',
        company = 'LigAI Dashboard',
        bio = 'Administrador do sistema',
        available_tokens = 99999
    WHERE email = 'admin@ligai.com';
    "
    
    sudo -u postgres psql -d ligai_db -c "$UPDATE_SQL" >/dev/null 2>&1
    
    if [[ $? -eq 0 ]]; then
        log "✅ Usuário admin atualizado!"
    else
        echo -e "${RED}❌ Erro na atualização${NC}"
        exit 1
    fi
else
    log "Criando novo usuário admin..."
    
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
        'Administrador do sistema',
        99999,
        365,
        '0',
        false
    );
    "
    
    sudo -u postgres psql -d ligai_db -c "$INSERT_SQL" >/dev/null 2>&1
    
    if [[ $? -eq 0 ]]; then
        log "✅ Usuário admin criado!"
    else
        echo -e "${RED}❌ Erro na criação${NC}"
        exit 1
    fi
fi

# Verificar resultado
log "Verificando usuário final..."
USER_INFO=$(sudo -u postgres psql -d ligai_db -c "
SELECT 
    id, 
    username, 
    email, 
    name, 
    phone,
    LEFT(password, 20) || '.' || RIGHT(password, 10) AS password_format
FROM users 
WHERE email = 'admin@ligai.com';
")

echo
echo -e "${GREEN}🎉 USUÁRIO ADMIN CONFIGURADO CORRETAMENTE! 🎉${NC}"
echo
echo "$USER_INFO"
echo
echo -e "${YELLOW}📋 Credenciais para Login:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "URL:      https://ligai.primerastreadores.com"
echo "Email:    admin@ligai.com"
echo "Senha:    admin123"
echo "Username: admin"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo -e "${GREEN}✅ A senha está agora no formato scrypt correto!${NC}"
echo -e "${GREEN}✅ Deve funcionar no login do dashboard!${NC}"

# Total de usuários
TOTAL_USERS=$(sudo -u postgres psql -d ligai_db -tAc "SELECT COUNT(*) FROM users;")
log "Total de usuários no sistema: $TOTAL_USERS"