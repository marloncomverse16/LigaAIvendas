-- Adiciona a coluna 'active' na tabela users
ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

-- Atualiza usuários existentes para terem active = true (ativados por padrão)
UPDATE users SET active = TRUE WHERE active IS NULL;