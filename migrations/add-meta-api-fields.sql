-- Adicionar campos de conexão direta ao WhatsApp Meta API na tabela users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS whatsapp_meta_phone_number_id TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_meta_connected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS whatsapp_meta_connected_at TIMESTAMP;

-- Adicionar campos de configuração WhatsApp Meta na tabela servers
ALTER TABLE servers
ADD COLUMN IF NOT EXISTS whatsapp_meta_token TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_meta_business_id TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_meta_api_version TEXT DEFAULT 'v18.0';

-- Comentário para documentação
COMMENT ON COLUMN users.whatsapp_meta_phone_number_id IS 'ID do número de telefone no WhatsApp Business na API da Meta';
COMMENT ON COLUMN users.whatsapp_meta_connected IS 'Indica se o usuário está conectado diretamente à API da Meta';
COMMENT ON COLUMN users.whatsapp_meta_connected_at IS 'Data e hora da última conexão à API da Meta';

COMMENT ON COLUMN servers.whatsapp_meta_token IS 'Token de acesso para API da Meta';
COMMENT ON COLUMN servers.whatsapp_meta_business_id IS 'ID do negócio na plataforma da Meta';
COMMENT ON COLUMN servers.whatsapp_meta_api_version IS 'Versão da API da Meta (padrão v18.0)';