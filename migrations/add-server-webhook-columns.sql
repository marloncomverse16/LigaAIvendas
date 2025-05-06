-- Adiciona as novas colunas de webhook na tabela de servidores
ALTER TABLE servers ADD COLUMN IF NOT EXISTS whatsapp_webhook_url TEXT;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS ai_agent_webhook_url TEXT;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS prospecting_webhook_url TEXT;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS contacts_webhook_url TEXT;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS scheduling_webhook_url TEXT;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS crm_webhook_url TEXT;