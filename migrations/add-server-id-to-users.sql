-- Adiciona uma coluna server_id na tabela de usuários para facilitar a busca
ALTER TABLE users ADD COLUMN IF NOT EXISTS server_id INTEGER;