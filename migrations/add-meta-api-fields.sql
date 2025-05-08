-- Adição de campos para Meta API na tabela user_servers
ALTER TABLE user_servers ADD COLUMN IF NOT EXISTS meta_phone_number_id TEXT;
ALTER TABLE user_servers ADD COLUMN IF NOT EXISTS meta_connected BOOLEAN DEFAULT FALSE;
ALTER TABLE user_servers ADD COLUMN IF NOT EXISTS meta_connected_at TIMESTAMP;
ALTER TABLE user_servers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- Atualizar os servidores existentes com uma coluna para versão da API Meta
ALTER TABLE servers ADD COLUMN IF NOT EXISTS whatsapp_meta_token TEXT;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS whatsapp_meta_business_id TEXT;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS whatsapp_meta_api_version TEXT DEFAULT 'v18.0';

-- Atualizar os usuários para remover campos de Meta API redundantes
-- (os campos correspondentes foram movidos para user_servers)
ALTER TABLE users DROP COLUMN IF EXISTS whatsapp_meta_phone_number_id;
ALTER TABLE users DROP COLUMN IF EXISTS whatsapp_meta_connected;
ALTER TABLE users DROP COLUMN IF EXISTS whatsapp_meta_connected_at;