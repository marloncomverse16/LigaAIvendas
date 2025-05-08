-- Adicionar colunas para a integração direta com a API do WhatsApp Cloud da Meta
-- Adicionamos as colunas diretamente à tabela settings para armazenar as configurações por usuário

ALTER TABLE settings
ADD COLUMN IF NOT EXISTS whatsapp_meta_token VARCHAR(512) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS whatsapp_meta_business_id VARCHAR(256) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS whatsapp_meta_api_version VARCHAR(50) DEFAULT 'v18.0';

-- Comentário: Estas colunas armazenam:
-- whatsapp_meta_token: Token de acesso permanente para a API da Meta
-- whatsapp_meta_business_id: ID do negócio/empresa no WhatsApp Business
-- whatsapp_meta_api_version: Versão da API sendo usada (padrão v18.0)

-- Adicionar coluna para armazenar o ID do número de telefone na tabela user_servers
-- Esta coluna armazena o ID do número específico que está conectado
ALTER TABLE user_servers
ADD COLUMN IF NOT EXISTS meta_phone_number_id VARCHAR(256) DEFAULT NULL;