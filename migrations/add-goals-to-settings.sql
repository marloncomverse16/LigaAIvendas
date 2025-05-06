-- Adiciona campos de metas à tabela settings
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS whatsapp_sending_goal INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS revenue_goal TEXT DEFAULT '0',
ADD COLUMN IF NOT EXISTS leads_goal INTEGER DEFAULT 0;